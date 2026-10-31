import { createServer } from "node:http";
import { expect, it, vi } from "vitest";
import { createApp } from "./app.js";
import { fixture, settings } from "./paypal/test-support.js";

it("permits exact-origin credentialed preflights without authentication and rejects other origins, methods and headers", async () => {
  const { service } = fixture();
  const owner = vi.fn();
  const command = vi.fn();
  const server = createServer(createApp(service, { owner, command }));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing server address");
    const base = `http://127.0.0.1:${address.port}`;
    for (const path of [
      "/sandbox/experiments/11111111-1111-4111-8111-111111111111/verified",
      "/experiments",
      "/sandbox/session",
    ]) {
      for (const method of ["GET", "POST", "OPTIONS"]) {
        const response = await fetch(base + path, {
          method: "OPTIONS",
          headers: {
            Origin: settings.CHECKOUT_ORIGIN,
            "Access-Control-Request-Method": method,
            "Access-Control-Request-Headers": "authorization, Content-Type",
          },
        });
        expect(response.status).toBe(204);
        expect(response.headers.get("access-control-allow-origin")).toBe(
          settings.CHECKOUT_ORIGIN,
        );
        expect(response.headers.get("access-control-allow-credentials")).toBe(
          "true",
        );
        expect(response.headers.get("access-control-allow-methods")).toBe(
          "GET, POST, OPTIONS",
        );
        expect(response.headers.get("access-control-allow-headers")).toBe(
          "Authorization, Content-Type",
        );
        expect(response.headers.get("vary")).toContain("Origin");
      }
    }
    for (const origin of [
      "http://localhost:5173",
      "http://127.0.0.1:5174",
      "https://untrusted.example",
      "null",
    ]) {
      for (const method of ["GET", "OPTIONS"]) {
        const response = await fetch(base + "/health", {
          method,
          headers: { Origin: origin, "Access-Control-Request-Method": "POST" },
        });
        expect(response.headers.get("access-control-allow-origin")).toBeNull();
        expect(
          response.headers.get("access-control-allow-credentials"),
        ).toBeNull();
        if (method === "OPTIONS") expect(response.status).toBe(403);
      }
    }
    for (const headers of [
      { "Access-Control-Request-Method": "DELETE" },
      {
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "X-Unapproved",
      },
    ]) {
      expect(
        (
          await fetch(base + "/experiments", {
            method: "OPTIONS",
            headers: { Origin: settings.CHECKOUT_ORIGIN, ...headers },
          })
        ).status,
      ).toBe(403);
    }
    expect(owner).not.toHaveBeenCalled();
    expect(command).not.toHaveBeenCalled();
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

it("keeps cookie security and actual-request authentication with credentialed CORS", async () => {
  const { service, id } = fixture();
  const owner = vi.fn().mockResolvedValue("test-owner");
  const command = vi.fn();
  const server = createServer(createApp(service, { owner, command }));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing server address");
    const base = `http://127.0.0.1:${address.port}`;
    const headers = {
      Origin: settings.CHECKOUT_ORIGIN,
      "Content-Type": "application/json",
    };
    const session = await fetch(base + "/sandbox/session", {
      method: "POST",
      headers,
      body: JSON.stringify({ accessKey: settings.CHECKOUT_ACCESS_KEY }),
    });
    expect(session.status).toBe(200);
    expect(session.headers.get("set-cookie")).toContain("HttpOnly");
    expect(session.headers.get("set-cookie")).toContain("SameSite=Strict");
    expect(session.headers.get("set-cookie")).toContain("Path=/sandbox");
    const status = await fetch(base + "/sandbox/session", {
      headers: { ...headers, Cookie: `sandbox_session=${id}` },
    });
    expect(status.status).toBe(200);
    expect(status.headers.get("access-control-allow-origin")).toBe(
      settings.CHECKOUT_ORIGIN,
    );
    expect(status.headers.get("access-control-allow-credentials")).toBe("true");
    const path =
      base +
      "/sandbox/experiments/11111111-1111-4111-8111-111111111111/verified";
    for (const [extra, expected] of [
      [{ Cookie: `sandbox_session=${id}` }, 401],
      [{ Authorization: "Bearer test-token" }, 401],
      [
        { Authorization: "Bearer test-token", Cookie: `sandbox_session=${id}` },
        409,
      ],
    ] as const) {
      const response = await fetch(path, {
        method: "POST",
        headers: { ...headers, ...extra },
        body: "{}",
      });
      expect(response.status).toBe(expected);
      expect(response.headers.get("access-control-allow-origin")).toBe(
        settings.CHECKOUT_ORIGIN,
      );
      expect(response.headers.get("access-control-allow-credentials")).toBe(
        "true",
      );
    }
    expect(command).not.toHaveBeenCalled();
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
