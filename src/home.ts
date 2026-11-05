import type { manifest } from "./assets";
import { certificateGuide, verifyCertificate } from "./discovery";
import { localized, type Locale } from "./locale";

export function home(info: ReturnType<typeof manifest>, locale: Locale) {
  const t = localized(locale);
  const labels: Record<string, string> = {
    "darwin-arm64": "macOS · Apple Silicon",
    "darwin-x64": "macOS · Intel",
    "linux-x64": "Linux · x64",
    "linux-arm64": "Linux · ARM64",
    "windows-x64": "Windows · x64",
  };
  const links = Object.entries(info.downloads)
    .map(
      ([platform, url]) => `<li><a href="${url}">${labels[platform]}</a></li>`,
    )
    .join("");
  const tls = info.tls;
  const pwa =
    (tls.enabled
      ? `<p><a href="${tls.url}/app">${tls.url}/app</a></p>` +
        (tls.ca
          ? `<p><a href="${tls.ca.url}">${t("Download the public CA certificate", "공개 CA 인증서 받기")}</a></p><pre>SHA-256  ${tls.ca.sha256}</pre><pre>${verifyCertificate}</pre>`
          : "")
      : "") + `<p>${certificateGuide(info, locale)}</p>`;
  return `<!doctype html><html lang="${locale}"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Upscayl · ${t("Home server", "홈 서버")}</title>
<style>:root{color-scheme:light dark;--ink:light-dark(#18231e,#e7eee9);--bg:light-dark(#fafbf8,#151a16);--line:light-dark(#d3dcd2,#3c443f);--link:light-dark(#1d6440,#92debd)}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,sans-serif}main{max-width:50rem;margin:4rem auto;padding:0 1.5rem}header{display:flex;align-items:baseline;gap:1rem}h1{font-size:2.5rem;letter-spacing:-.05em;margin:0}h2{font-size:1.25rem;margin:.2rem 0 .6rem}h3{font-size:1rem;margin:1rem 0 .25rem}section{border-top:1px solid var(--line);padding:1.2rem 0}pre{border-left:3px solid var(--link);padding:.5rem 1rem;overflow:auto}a{color:var(--link);text-underline-offset:.2em}ul{padding-left:1.3rem}footer{border-top:1px solid var(--line);padding-top:1rem;display:flex;gap:1rem;flex-wrap:wrap}</style>
<main><a href="/app">← Upscayl</a><header><h1>Upscayl</h1><span>v${info.version}</span></header>
<p>${t("Upscale images on the host GPU from a device on the same network.", "같은 공유기의 PC에서 호스트의 GPU로 이미지를 업스케일합니다.")}</p>
<section><h2>${t("Connect an agent", "에이전트 연결")}</h2><p>${t('Give your agent the home server address. Connection settings and downloads are in <a href="/manifest.json">manifest.json</a>.', '에이전트에게 홈 서버 주소를 전달하세요. 연결 설정과 다운로드 목록은 <a href="/manifest.json">manifest.json</a>에서 확인할 수 있습니다.')}</p>
<p>${t("Register this URL in your Streamable HTTP MCP client.", "Streamable HTTP를 지원하는 MCP 클라이언트에 이 주소를 등록하세요.")}</p><pre>${info.mcp}</pre><h3>Codex</h3><pre>${info.codex}</pre><h3>OpenCode</h3><p>${t("Merge this entry into your existing settings.", "기존 설정에 아래 항목을 병합하세요.")}</p><pre>${JSON.stringify(info.opencode, null, 2)}</pre></section>
<section><h2>${t("Client skill", "클라이언트 스킬")}</h2><a href="${info.skill}">${t("Download the upscayl client skill", "클라이언트용 upscayl ZIP 받기")}</a><p>${t("Extract the ZIP into your agent’s skills directory. The CLI defaults to <code>~/.agents/skills</code>. Use <code>upscayl-mcp skill install --dir PATH</code> for another directory.", "ZIP을 에이전트의 스킬 폴더에 풉니다. CLI의 기본 경로는 <code>~/.agents/skills</code>이며, <code>upscayl-mcp skill install --dir PATH</code>로 바꿀 수 있습니다.")}</p></section>
<section><h2>${t("Download the CLI", "터미널용 CLI 다운로드")}</h2><p>${t("Each ZIP includes the CLI and server. Upscayl and the GPU run on the host.", "ZIP 하나에 CLI와 서버가 함께 들어 있습니다. GPU와 Upscayl 앱은 호스트에서 사용합니다.")}</p><ul>${links}</ul></section>
<section><h2>${t("Install as an app", "앱으로 설치")}</h2>${pwa}<p>${t("Use your browser’s install menu. On iPhone, choose Add to Home Screen from the share menu. The interface opens offline. Upscaling requires a connection to the host.", "브라우저 설치 메뉴를 사용하세요. iPhone에서는 공유 메뉴의 ‘홈 화면에 추가’를 선택하세요. 오프라인에서도 앱 화면을 열 수 있고, 업스케일을 실행하려면 호스트 연결이 필요합니다.")}</p></section>
<details><summary>${t("On the host", "홈 서버 운영")}</summary><p>${t("Install the host skill with <code>upscayl-mcp skill install --role host</code> for local processing and server operations.", "로컬 CLI와 서버 운영을 위한 호스트 스킬은 <code>upscayl-mcp skill install --role host</code>로 설치하세요.")} <a href="${info.skills.host.url}">${t("Download upscayl-host ZIP", "upscayl-host ZIP 받기")}</a></p></details>
<footer><a href="${info.checksums}">${t("SHA256 checksums", "SHA256 체크섬")}</a><a href="${info.repository}">${t("GitHub repository", "GitHub 저장소")}</a></footer></main></html>`;
}
