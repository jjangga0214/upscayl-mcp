import type { manifest } from "./assets";

import { localized, type Locale } from "./locale";
type Format = "html" | "markdown" | "json" | "guideHtml";
export function rootFormat(h: Headers): Format {
  const agent =
    /(?:GPTBot|ChatGPT-User|OAI-SearchBot|ClaudeBot|Claude-User|Claude-SearchBot|PerplexityBot|Perplexity-User|Google-Extended|\bCodex\b|\bOpenCode\b)/i.test(
      h.get("user-agent") || "",
    );
  const accepts = (h.get("accept") || "")
    .toLowerCase()
    .split(",")
    .map((part) => {
      const [type, ...params] = part.trim().split(";");
      const weight = params.find((p) => p.trim().startsWith("q="));
      return { type, q: weight ? Number(weight.trim().slice(2)) : 1 };
    })
    .filter((a) => a.q > 0)
    .sort((a, b) => b.q - a.q);
  for (const { type } of accepts) {
    if (type === "application/json") return "json";
    if (type === "text/markdown" || type === "text/plain") return "markdown";
    if (type === "text/html" || type === "application/xhtml+xml")
      return agent ? "guideHtml" : "html";
  }
  if (
    !agent &&
    (h.get("sec-fetch-mode") === "navigate" ||
      h.get("sec-fetch-dest") === "document")
  )
    return "html";
  return "markdown";
}
export function agentGuide(
  m: ReturnType<typeof manifest>,
  locale: Locale = "en",
) {
  const t = localized(locale);
  return [
    t("# Upscayl on this home LAN", "# 홈 네트워크의 Upscayl"),
    "",
    m.instructions,
    "",
    t("## Connect", "## 연결"),
    "Streamable HTTP MCP: " + m.mcp,
    "Codex: `" + m.codex + "`",
    t(
      "OpenCode: merge this JSON with your configuration:",
      "OpenCode 설정에 다음 JSON을 병합하세요.",
    ),
    "```json",
    JSON.stringify(m.opencode, null, 2),
    "```",
    "",
    t(
      "## Client skill (Codex and OpenCode)",
      "## 클라이언트 스킬 (Codex 및 OpenCode)",
    ),
    t("Skill ZIP: ", "스킬 ZIP: ") + m.skills.client.url,
    t("Skill SHA-256: ", "스킬 SHA-256: ") + m.skills.client.sha256,
    "",
    t(
      "## Optional remote CLI for shell workflows",
      "## 터미널용 원격 CLI (선택)",
    ),
    t(
      "Example: upscayl-mcp upscale photo.png --server ",
      "사용 예: upscayl-mcp upscale photo.png --server ",
    ) +
      new URL(m.mcp).origin +
      " --output result.png",
    ...Object.entries(m.downloads).map(
      ([platform, url]) => "- " + platform + ": " + url,
    ),
    "SHA256SUMS: " + m.checksums,
    "",
    t("Machine-readable manifest: ", "설정 JSON: ") + m.manifest,
    t("Browser app: ", "웹 앱: ") + m.app.replace(/\/$/, "") + "/app",
    t("Repository: ", "저장소: ") + m.repository,
    "",
  ].join("\n");
}
