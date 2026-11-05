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
export const verifyCertificate =
  "openssl x509 -inform DER -in upscayl-lan-ca.cer -noout -fingerprint -sha256";

export function certificateGuide(
  info: ReturnType<typeof manifest>,
  locale: Locale,
) {
  const t = localized(locale);
  if (!info.tls.enabled)
    return t(
      "This host serves HTTP. For an installable LAN PWA, configure HTTPS on the host.",
      "이 호스트는 HTTP를 제공합니다. LAN에서 PWA를 설치하려면 호스트에 HTTPS를 설정하세요.",
    );
  if (!info.tls.ca)
    return t(
      "Use the configured HTTPS name with a device or agent that trusts its issuer. If it uses a private CA, obtain the public root and its fingerprint from the operator.",
      "HTTPS 주소에 접속할 기기와 에이전트가 발급 기관을 신뢰해야 합니다. 사설 CA를 쓴다면 운영자에게 공개 루트 인증서와 지문을 받으세요.",
    );
  return t(
    "Before trusting the public CA on a client, match the downloaded certificate’s SHA-256 fingerprint with the one printed by the host at startup or shown by macOS server status.",
    "클라이언트에서 공개 CA를 신뢰하기 전에 다운로드한 인증서의 SHA-256 지문을 호스트 시작 시 출력된 값 또는 macOS의 server status 값과 대조하세요.",
  );
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
    t("Client setup examples", "클라이언트 설정 예시"),
    "Codex: `" + m.codex + "`",
    t(
      "OpenCode: merge this JSON with your configuration:",
      "OpenCode 설정에 다음 JSON을 병합하세요.",
    ),
    "```json",
    JSON.stringify(m.opencode, null, 2),
    "```",
    "",
    t("## HTTPS and certificates", "## HTTPS와 인증서"),
    ...(m.tls.enabled ? ["HTTPS: " + m.tls.url] : []),
    ...(m.tls.enabled && m.tls.ca
      ? [
          t("Public CA: ", "공개 CA: ") + m.tls.ca.url,
          "SHA-256: " + m.tls.ca.sha256,
          "`" + verifyCertificate + "`",
        ]
      : []),
    certificateGuide(m, locale),
    "",
    t("## Optional client skill", "## 클라이언트 스킬 (선택 사항)"),
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
