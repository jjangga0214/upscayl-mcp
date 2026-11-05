import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { version } from "../package.json";
import { optionsSchema } from "./engine";
import type { Jobs } from "./jobs";

import { describeModel } from "./catalog";
import { localized, type Locale } from "./locale";
export function models(jobs: Jobs, locale: Locale = "en") {
  return [...jobs.backend.models.values()].map(({ id, nativeScale }) => ({
    id,
    nativeScale,
    ...describeModel(id, locale),
  }));
}
export async function handleMcp(req: Request, jobs: Jobs, locale: Locale) {
  const t = localized(locale);
  const server = new McpServer(
    { name: "upscayl-mcp", version },
    {
      instructions: t(
        "Read GET /manifest.json on this same host for client setup and the skills.client download. Upload raw PNG/JPEG/WebP bytes via POST /files first. Tool inputs use the returned file_id. Poll get_job, then download its relative result URL on this host. Remote caches expire five minutes after completion (expires_at), even after reads. Save the result on the requesting computer.",
        "같은 호스트의 /manifest.json에서 연결 설정과 skills.client 다운로드 주소를 확인하세요. PNG/JPEG/WebP 원본 바이트를 POST /files로 전송하고 받은 file_id로 작업을 요청하세요. get_job으로 상태를 확인하고 결과의 상대 경로를 이 호스트에서 내려받아 요청한 기기에 저장하세요. 서버 사본은 완료 5분 후(expires_at)에 삭제되며, 조회해도 기한이 늘어나지 않습니다.",
      ),
    },
  );
  const reply = (value: unknown) => ({
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
  });
  const id = z.string().uuid();
  const opts = optionsSchema
    .optional()
    .describe(
      t(
        "Upscayl desktop settings. Omit for Standard 4× PNG.",
        "Upscayl 데스크톱 설정입니다. 생략하면 Standard 모델로 4배 업스케일한 PNG를 생성합니다.",
      ),
    );
  server.registerTool(
    "list_models",
    {
      description: t(
        "Models available on this host.",
        "이 호스트에서 사용할 수 있는 모델을 조회합니다.",
      ),
    },
    () => reply(models(jobs, locale)),
  );
  server.registerTool(
    "explain_upscale",
    {
      description: t(
        "Show the native AI passes, output dimensions and resize operations for an uploaded image.",
        "업로드한 이미지의 AI 처리 횟수, 출력 크기, 리사이즈 과정을 확인합니다.",
      ),
      inputSchema: { file_id: id, options: opts },
    },
    ({ file_id, options }) =>
      reply(jobs.explain(file_id, optionsSchema.parse(options ?? {}))),
  );
  server.registerTool(
    "upscale",
    {
      description: t(
        "Queue one uploaded image on the host GPU.",
        "업로드한 이미지 한 장을 호스트의 GPU 처리 대기열에 추가합니다.",
      ),
      inputSchema: { file_id: id, options: opts },
    },
    ({ file_id, options }) =>
      reply(jobs.submit([file_id], optionsSchema.parse(options ?? {}))[0]),
  );
  server.registerTool(
    "upscale_batch",
    {
      description: t(
        "Queue a folder's uploaded images with one set of desktop batch options; results preserve input order.",
        "업로드한 폴더의 이미지에 같은 일괄 설정을 적용합니다. 결과는 입력 순서대로 제공됩니다.",
      ),
      inputSchema: { file_ids: z.array(id).min(1).max(32), options: opts },
    },
    ({ file_ids, options }) => {
      const settings = optionsSchema.parse(options ?? {});
      if (settings.double)
        throw Error(
          t(
            "Double is a single-image desktop mode.",
            "Double은 데스크톱에서 이미지 한 장을 처리할 때 사용할 수 있습니다.",
          ),
        );
      return reply(jobs.submit(file_ids, settings));
    },
  );
  server.registerTool(
    "get_job",
    {
      description: t(
        "Get progress and result download path.",
        "진행 상태와 결과 다운로드 경로를 조회합니다.",
      ),
      inputSchema: { job_id: id },
    },
    ({ job_id }) => reply(jobs.view(job_id)),
  );
  server.registerTool(
    "cancel_job",
    {
      description: t(
        "Stop a pending or running job.",
        "대기 중이거나 실행 중인 작업을 취소합니다.",
      ),
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
