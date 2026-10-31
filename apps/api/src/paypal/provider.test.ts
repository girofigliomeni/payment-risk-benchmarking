import { describe, expect, it, vi } from "vitest";
import { SandboxPayPalProvider } from "./provider.js";
import { settings, headers, example } from "./test-support.js";

describe("server-only PayPal transport", () => {
  it("uses sandbox OAuth, fixed server amount, hosted URLs, and stable request headers", async () => {
    const transport = vi.fn<typeof fetch>();
    transport
      .mockResolvedValueOnce(
        Response.json({
          access_token: "mock-bearer-never-returned",
          expires_in: 3600,
        }),
      )
      .mockImplementation(async () => Response.json({ id: "MOCK-ORDER" }));
    const provider = new SandboxPayPalProvider(settings, transport);
    const input = {
      requestId: "mock-create-key",
      actorId: "mock-actor",
      amount: "1.00",
      returnUrl: "http://127.0.0.1:5173/?checkout=approved",
      cancelUrl: "http://127.0.0.1:5173/?checkout=cancelled",
    };
    await provider.createOrder(input);
    await provider.captureOrder("MOCK-ORDER", "mock-capture-key");
    await provider.captureOrder("MOCK-ORDER", "mock-capture-key");
    expect(
      transport.mock.calls.every(([url]) =>
        String(url).startsWith("https://api-m.sandbox.paypal.com/"),
      ),
    ).toBe(true);
    expect(transport.mock.calls[0]?.[1]?.body).toBe(
      "grant_type=client_credentials",
    );
    const create = transport.mock.calls[1]?.[1];
    expect(create?.headers).toMatchObject({
      "PayPal-Request-Id": "mock-create-key",
    });
    expect(JSON.parse(String(create?.body))).toMatchObject({
      intent: "CAPTURE",
      purchase_units: [{ amount: { value: "1.00", currency_code: "USD" } }],
    });
    expect(transport.mock.calls[2]?.[1]?.headers).toMatchObject({
      "PayPal-Request-Id": "mock-capture-key",
    });
    expect(transport.mock.calls[3]?.[1]?.headers).toMatchObject({
      "PayPal-Request-Id": "mock-capture-key",
    });
    expect(
      transport.mock.calls.filter(([url]) => String(url).endsWith("/token")),
    ).toHaveLength(1);
  });
  it("preserves raw webhook JSON in the postback and fails closed on signature failure", async () => {
    const transport = vi.fn<typeof fetch>();
    transport
      .mockResolvedValueOnce(
        Response.json({ access_token: "mock-token", expires_in: 3600 }),
      )
      .mockResolvedValueOnce(Response.json({ verification_status: "SUCCESS" }))
      .mockResolvedValueOnce(Response.json({ verification_status: "FAILURE" }));
    const provider = new SandboxPayPalProvider(settings, transport);
    const raw = JSON.stringify(example, null, 2);
    expect(await provider.verifyWebhook(raw, headers)).toBe(true);
    expect(String(transport.mock.calls[1]?.[1]?.body)).toContain(
      `"webhook_event":${raw}`,
    );
    expect(
      JSON.parse(String(transport.mock.calls[1]?.[1]?.body)),
    ).toMatchObject({
      webhook_id: settings.PAYPAL_WEBHOOK_ID,
      webhook_event: example,
    });
    expect(await provider.verifyWebhook(raw, headers)).toBe(false);
  });
  it("redacts provider errors and transport failures", async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response("mock-secret personal payload", { status: 401 }),
      );
    await expect(
      new SandboxPayPalProvider(settings, transport).getOrder("MOCK"),
    ).rejects.toThrow("paypal_request_failed");
    transport.mockRejectedValue(new Error("mock-token-leak"));
    await expect(
      new SandboxPayPalProvider(settings, transport).getOrder("MOCK"),
    ).rejects.toThrow("paypal_unavailable_retry_safely");
  });
});
