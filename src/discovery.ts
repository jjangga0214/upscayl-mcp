import type { manifest } from "./assets";

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
export function agentGuide(m: ReturnType<typeof manifest>) {
  return [
    "# Upscayl on this home LAN",
    "",
    m.instructions,
    "",
    "## Connect",
    "Streamable HTTP MCP: " + m.mcp,
    "Codex: `" + m.codex + "`",
    "OpenCode: merge this JSON with your configuration:",
    "```json",
    JSON.stringify(m.opencode, null, 2),
    "```",
    "",
    "## Downloads",
    "Skill ZIP: " + m.skill,
    "Skill SHA-256: " + m.skill_sha256,
    ...Object.entries(m.downloads).map(
      ([platform, url]) => "- " + platform + ": " + url,
    ),
    "SHA256SUMS: " + m.checksums,
    "",
    "Machine-readable manifest: " + m.manifest,
    "Browser app: " + m.app.replace(/\/$/, "") + "/app",
    "Repository: " + m.repository,
    "",
  ].join("\n");
}
