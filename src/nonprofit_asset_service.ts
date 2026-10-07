import { createServer, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { assetKinds, planAsset } from "./asset_policy.js";
import { InfraiError, infrai } from "./infrai_storage.js";

const bucket = process.env.INFRAI_ASSET_BUCKET ?? "nonprofit-product-assets";
const port = Number(process.env.PORT ?? 3000);

const issueSchema = z.object({
  assetKind: z.enum(assetKinds),
  recordId: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
});

const confirmSchema = issueSchema;

async function readJson(request: AsyncIterable<Uint8Array>): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function json(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(value));
}

function clientStatus(error: InfraiError): number {
  return error.status >= 400 && error.status < 500 ? error.status : 502;
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/assets/upload-intents") {
      const input = issueSchema.parse(await readJson(request));
      const plan = planAsset(input.assetKind, input.recordId);
      const signed = await infrai.storage.object.presign(bucket, plan.key, {
        op: "put",
        expires_seconds: 600,
        content_type: plan.contentType,
        max_bytes: plan.maxBytes,
        idempotency_key: randomUUID(),
      });
      json(response, 201, {
        assetKind: input.assetKind,
        recordId: input.recordId,
        key: plan.key,
        state: "awaiting_upload",
        upload: { method: "PUT", url: signed.url, contentType: plan.contentType },
      });
      return;
    }

    if (request.method === "POST" && request.url === "/assets/confirm") {
      const input = confirmSchema.parse(await readJson(request));
      const plan = planAsset(input.assetKind, input.recordId);
      const object = await infrai.storage.object.head(bucket, plan.key);
      json(response, object.found ? 200 : 202, {
        assetKind: input.assetKind,
        recordId: input.recordId,
        key: plan.key,
        state: object.found ? "ready" : "awaiting_upload",
        ...(object.found ? { bytes: object.size, contentType: object.content_type } : {}),
      });
      return;
    }

    json(response, 404, { error: "Route not found" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      json(response, 400, { error: "Invalid request body", issues: error.issues });
      return;
    }
    if (error instanceof InfraiError) {
      json(response, clientStatus(error), { error: error.code, message: error.message });
      return;
    }
    json(response, 500, { error: "Unexpected service error" });
  }
});

server.listen(port, () => {
  console.log(`Nonprofit asset service listening on http://localhost:${port}`);
});
