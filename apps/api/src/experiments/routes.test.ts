import { createServer } from "node:http";
import express from "express";
import { expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { PaymentError } from "../paypal/provider.js";
import type { ExperimentStore } from "./store.js";
import { SupabaseExperimentStore } from "./store.js";
import { fixture } from "../paypal/test-support.js";

const id = "11111111-1111-4111-8111-111111111111";
const owner = "22222222-2222-4222-8222-222222222222";
const event = {
  eventId: "e1",
  actorId: "fictional-a",
  occurredAt: "2026-01-01T00:00:00Z",
  source: "synthetic",
  eventType: "deposit",
  amountMinor: 100,
  currency: "USD",
  status: "completed",
  provenance: {
    source: "synthetic",
    datasetId: "dataset",
    seed: 42,
    generatorVersion: "synthetic-v1",
  },
};
it("limits each client to 120 requests and clears all client counts after 60 seconds", async () => {
  let client = "192.0.2.1";
  let now = 0;
  const ip = vi
    .spyOn(express.request, "ip", "get")
    .mockImplementation(() => client);
  const clock = vi.spyOn(Date, "now").mockImplementation(() => now);
  const store = {
    owner: vi.fn().mockResolvedValue(owner),
    command: vi.fn().mockResolvedValue({}),
  };
  try {
    await withApi(store, async (post) => {
      const send = () => post(`/experiments/${id}/events`, { events: [event] });
      for (let n = 0; n < 120; n++) expect((await send()).status).toBe(200);
      expect((await send()).status).toBe(429);
      client = "192.0.2.2";
      for (let n = 0; n < 120; n++) expect((await send()).status).toBe(200);
      now = 59999;
      expect((await send()).status).toBe(429);
      now = 60000;
      expect((await send()).status).toBe(200);
      client = "192.0.2.1";
      expect((await send()).status).toBe(200);
    });
  } finally {
    ip.mockRestore();
    clock.mockRestore();
  }
});
async function withApi(
  store: ExperimentStore | undefined,
  test: (
    post: (path: string, body: unknown, token?: string) => Promise<Response>,
  ) => Promise<void>,
) {
  const server = createServer(createApp(undefined, store));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("address required");
    await test((path, body, token = "user-token") =>
      fetch(`http://127.0.0.1:${address.port}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      }),
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
it("fails explicitly without storage configuration or authentication", async () => {
  await withApi(undefined, async (post) =>
    expect((await post("/experiments", {})).status).toBe(503),
  );
  const store = { owner: vi.fn(), command: vi.fn() };
  await withApi(store, async (post) =>
    expect((await post("/experiments", {}, "")).status).toBe(401),
  );
  expect(store.command).not.toHaveBeenCalled();
});
it("accepts only synthetic ingestion, rejects labels and provider verification claims and limits batches", async () => {
  const store = {
    owner: vi.fn().mockResolvedValue(owner),
    command: vi.fn().mockResolvedValue({ eventCount: 1 }),
  };
  await withApi(store, async (post) => {
    expect(
      (await post(`/experiments/${id}/events`, { events: [event] })).status,
    ).toBe(200);
    expect(store.command).toHaveBeenLastCalledWith(owner, id, "ingest", {
      events: [event],
    });
    for (const body of [
      { events: [{ ...event, label: "anomalous" }] },
      { events: [{ ...event, source: "paypal_sandbox" }] },
      { events: [event], labels: [] },
      { events: Array.from({ length: 501 }, () => event) },
    ]) {
      expect((await post(`/experiments/${id}/events`, body)).status).toBe(400);
    }
    expect(
      (
        await post(`/experiments/${id}/events`, {
          events: [],
          padding: "x".repeat(1_048_577),
        })
      ).status,
    ).toBe(413);
    expect(
      (await post(`/sandbox/experiments/${id}/verified`, { event })).status,
    ).toBe(400);
    expect((await post(`/sandbox/experiments/${id}/verified`, {})).status).toBe(
      401,
    );
  });
  expect(store.command).toHaveBeenCalledTimes(1);
});
it("scores only projected observables and sends identical decisions on repeated saved runs", async () => {
  const command = vi
    .fn<ExperimentStore["command"]>()
    .mockImplementation(async (_owner, _id, action, data) => {
      if (action === "snapshot") return { events: [event] };
      return data;
    });
  await withApi({ owner: async () => owner, command }, async (post) => {
    const first = await (await post(`/experiments/${id}/baseline`, {})).json();
    expect(
      await (await post(`/experiments/${id}/baseline`, {})).json(),
    ).toEqual(first);
    expect(first).toMatchObject({
      version: "rules-v1",
      decisions: [{ decision: "pass", reasons: [], evidenceEventIds: ["e1"] }],
    });
    expect(JSON.stringify(first)).not.toContain("dataset");
    expect(
      (await post(`/experiments/${id}/baseline`, { labels: [] })).status,
    ).toBe(400);
    expect((await post(`/experiments/${id}/labels`, {})).status).toBe(404);
  });
  expect(command.mock.calls.map((call) => call[2])).toEqual([
    "snapshot",
    "save",
    "snapshot",
    "save",
  ]);
});
it("uses the verified user identity and preserves isolation errors", async () => {
  const command = vi
    .fn()
    .mockRejectedValue(new PaymentError(404, "experiment_request_rejected"));
  const authenticate = vi.fn().mockResolvedValue(owner);
  await withApi({ owner: authenticate, command }, async (post) => {
    expect(
      (await post(`/experiments/${id}/events`, { events: [event] })).status,
    ).toBe(404);
    expect(authenticate).toHaveBeenCalledWith("user-token");
    expect(command).toHaveBeenCalledWith(owner, id, "ingest", {
      events: [event],
    });
    expect((await post("/experiments/not-a-uuid/baseline", {})).status).toBe(
      400,
    );
  });
});
it("validates bearer tokens via Auth and confines persistence to the server RPC", async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(JSON.stringify({ id: owner })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ eventCount: 1 })))
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({ code: "23505", message: "private detail" }),
        { status: 409 },
      ),
    )
    .mockResolvedValueOnce(new Response("{}", { status: 401 }));
  const store = new SupabaseExperimentStore(
    "https://example.supabase.co",
    "server-only-key",
    request,
  );
  expect(await store.owner("user-token")).toBe(owner);
  await expect(
    store.command(owner, id, "ingest", { events: [event] }),
  ).resolves.toEqual({ eventCount: 1 });
  expect(request.mock.calls[0]![0]).toBe(
    "https://example.supabase.co/auth/v1/user",
  );
  const sent = request.mock.calls[1]![1]!;
  expect(JSON.parse(String(sent.body))).toEqual({
    p_owner: owner,
    p_experiment: id,
    p_action: "ingest",
    p_data: { events: [event] },
  });
  await expect(store.command(owner, id, "ingest", {})).rejects.toMatchObject({
    status: 409,
    code: "experiment_request_rejected",
  });
  await expect(store.owner("bad-token")).rejects.toMatchObject({ status: 401 });
});
it("imports only the checkout adapter event, without initiating or repeating a capture", async () => {
  const { service, provider, id: checkoutId } = fixture();
  const command = vi.fn().mockResolvedValue({ eventCount: 1 });
  const server = createServer(
    createApp(service, { owner: async () => owner, command }),
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("address required");
    const send = () =>
      fetch(
        `http://127.0.0.1:${address.port}/sandbox/experiments/${id}/verified`,
        {
          method: "POST",
          headers: {
            Authorization: "Bearer user-token",
            Cookie: `sandbox_session=${checkoutId}`,
            "Content-Type": "application/json",
          },
          body: "{}",
        },
      );
    expect((await send()).status).toBe(409);
    expect(provider.captureOrder).not.toHaveBeenCalled();
    await service.create(checkoutId);
    await service.capture(checkoutId);
    const verified = service.status(checkoutId).event;
    expect((await send()).status).toBe(200);
    expect((await send()).status).toBe(200);
    expect(command).toHaveBeenLastCalledWith(owner, id, "ingest", {
      events: [verified],
    });
    expect(provider.captureOrder).toHaveBeenCalledTimes(1);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
