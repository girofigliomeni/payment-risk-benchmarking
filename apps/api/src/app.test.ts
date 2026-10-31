import { createServer } from "node:http";
import { expect, it } from "vitest";
import { HealthSchema } from "@payment-risk/core";
import { app } from "./app.js";
it("serves the shared health contract over HTTP", async () => {
  const server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  try {
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing server address");
    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    expect(response.status).toBe(200);
    expect(HealthSchema.parse(await response.json()).status).toBe("ok");
    expect(response.headers.get("cache-control")).toBe("no-store");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
});
