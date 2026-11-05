import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { version } from "../package.json";
import { optionsSchema } from "./engine";
import type { Jobs } from "./jobs";

import { describeModel } from "./catalog";
export function models(jobs: Jobs) {
  return [...jobs.backend.models.values()].map(({ id, nativeScale }) => ({
    id,
    nativeScale,
    ...describeModel(id),
  }));
}
export async function handleMcp(req: Request, jobs: Jobs) {
  const server = new McpServer(
    { name: "upscayl-mcp", version },
    {
      instructions:
        "Read GET /manifest.json on this same host for client setup and the skills.client download. Upload raw PNG/JPEG/WebP bytes via POST /files first. Tool inputs use the returned file_id. Poll get_job, then download its relative result URL on this host. Remote caches expire five minutes after completion (expires_at), even after reads. Save the result on the requesting computer.",
    },
  );
  const reply = (value: unknown) => ({
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
  });
  const id = z.string().uuid();
  const opts = optionsSchema
    .optional()
    .describe("Upscayl desktop settings. Omit for Standard 4× PNG.");
  server.registerTool(
    "list_models",
    { description: "Models available on this Mac." },
    () => reply(models(jobs)),
  );
  server.registerTool(
    "explain_upscale",
    {
      description:
        "Show the native AI passes, output dimensions and resize operations for an uploaded image.",
      inputSchema: { file_id: id, options: opts },
    },
    ({ file_id, options }) =>
      reply(jobs.explain(file_id, optionsSchema.parse(options ?? {}))),
  );
  server.registerTool(
    "upscale",
    {
      description: "Queue one uploaded image on the Mac GPU.",
      inputSchema: { file_id: id, options: opts },
    },
    ({ file_id, options }) =>
      reply(jobs.submit([file_id], optionsSchema.parse(options ?? {}))[0]),
  );
  server.registerTool(
    "upscale_batch",
    {
      description:
        "Queue a folder's uploaded images with one set of desktop batch options; results preserve input order.",
      inputSchema: { file_ids: z.array(id).min(1).max(32), options: opts },
    },
    ({ file_ids, options }) => {
      const settings = optionsSchema.parse(options ?? {});
      if (settings.double)
        throw Error("Double is a single-image desktop mode.");
      return reply(jobs.submit(file_ids, settings));
    },
  );
  server.registerTool(
    "get_job",
    {
      description: "Get progress and result download path.",
      inputSchema: { job_id: id },
    },
    ({ job_id }) => reply(jobs.view(job_id)),
  );
  server.registerTool(
    "cancel_job",
    {
      description: "Stop a pending or running job.",
      inputSchema: { job_id: id },
    },
    ({ job_id }) => reply(jobs.cancel(job_id)),
  );
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  try {
    await server.connect(transport);
    return await transport.handleRequest(req);
  } finally {
    await server.close();
  }
}
