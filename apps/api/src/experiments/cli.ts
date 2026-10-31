import { parseArgs } from "node:util";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { z } from "zod";
import { PaymentEventSchema } from "@payment-risk/core";
import { SavedRunSchema } from "./store.js";

async function main() {
  config({
    path: fileURLToPath(new URL("../../../../.env", import.meta.url)),
    quiet: true,
  });
  const { values } = parseArgs({
    options: {
      experiment: { type: "string" },
      events: { type: "string" },
      name: { type: "string" },
      help: { type: "boolean" },
    },
    strict: true,
  });
  if (values.help) {
    console.log(
      "Usage: npm run baseline -- --experiment <uuid> [--events <saved events.jsonl> --name <name>]\nRequires EXPERIMENT_ACCESS_TOKEN and optional EXPERIMENT_API_URL. Imports synthetic events only; never reads labels. Existing experiment becomes immutable on first baseline run.",
    );
    return;
  }
  const id = z.uuid().parse(values.experiment);
  const token = z.string().min(1).parse(process.env.EXPERIMENT_ACCESS_TOKEN);
  const base = new URL(
    process.env.EXPERIMENT_API_URL ?? "http://127.0.0.1:3001",
  );
  if (
    base.protocol !== "https:" &&
    !(
      base.protocol === "http:" &&
      ["127.0.0.1", "localhost"].includes(base.hostname)
    )
  )
    throw new Error("API URL requires HTTPS or local HTTP");
  async function post(path: string, body: unknown): Promise<unknown> {
    const response = await fetch(new URL(`/experiments${path}`, base), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok)
      throw new Error(
        `Experiment request failed (${response.status}); check server setup, ownership and immutable dataset constraints`,
      );
    try {
      return await response.json();
    } catch {
      throw new Error("Invalid experiment response");
    }
  }
  if (values.events !== undefined) {
    if (!values.events) throw new Error("--events requires a path");
    const content = await readFile(resolve(values.events), "utf8");
    if (Buffer.byteLength(content) > 20_000_000)
      throw new Error("Saved file exceeds 20MB");
    const events = content
      .trim()
      .split(/\r?\n/)
      .map((line) => PaymentEventSchema.options[0].parse(JSON.parse(line)));
    const first = events[0];
    if (!first || events.length > 10000)
      throw new Error("Expected 1 to 10000 synthetic events");
    if (
      events.some(
        (event) =>
          event.provenance.datasetId !== first.provenance.datasetId ||
          event.provenance.seed !== first.provenance.seed,
      )
    )
      throw new Error("Mixed datasets");
    await post("", {
      experimentId: id,
      name: values.name ?? "Saved seeded experiment",
      datasetId: first.provenance.datasetId,
      seed: first.provenance.seed,
    });
    for (let start = 0; start < events.length; start += 500)
      await post(`/${id}/events`, { events: events.slice(start, start + 500) });
  }
  const run = SavedRunSchema.safeParse(await post(`/${id}/baseline`, {}));
  if (!run.success) throw new Error("Invalid experiment response");
  console.log(JSON.stringify(run.data, null, 2));
}
main().catch((error: unknown) => {
  const detail = error instanceof Error ? error.message : "Unknown error";
  console.error(
    `Baseline failed: ${detail}. Check arguments, saved synthetic file, authentication and server/database configuration. No payment was initiated.`,
  );
  process.exitCode = 1;
});
