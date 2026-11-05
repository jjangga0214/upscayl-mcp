import type { manifest } from "./assets";

import type { httpsSettings } from "./tls";
export function home(
  info: ReturnType<typeof manifest>,
  secure?: ReturnType<typeof httpsSettings>,
) {
  const pwa =
    "<section><h2>앱으로 설치</h2>" +
    (secure
      ? '<p><a href="' +
        secure.url +
        '/app">HTTPS에서 Upscayl 열기</a></p>' +
        (secure.ca
          ? '<p>처음 접속하는 기기에서는 <a href="/pwa-ca.cer">홈 서버의 공개 CA 인증서</a>를 받아 기기에 신뢰 등록하세요. 등록 전 호스트 맥의 <code>upscayl-mcp server status</code>에 표시된 SHA-256 지문을 대조하세요.</p><pre>' +
            secure.ca.fingerprint256 +
            "</pre>"
          : "")
      : "<p>LAN에서 앱을 설치하려면 호스트에 HTTPS를 설정하세요. 같은 기기에서는 루프백 주소로도 설치할 수 있습니다.</p>") +
    "<p>브라우저 설치 메뉴를 사용하세요. iPhone에서는 공유 메뉴의 ‘홈 화면에 추가’를 선택하세요. 오프라인에서는 앱 화면을 열 수 있고, 업스케일을 실행하려면 홈 서버에 연결해야 합니다.</p></section>";
  const labels: Record<string, string> = {
    "darwin-arm64": "macOS · Apple Silicon",
    "darwin-x64": "macOS · Intel",
    "linux-x64": "Linux · x64",
    "linux-arm64": "Linux · ARM64",
    "windows-x64": "Windows · x64",
  };
  const links = Object.entries(info.downloads)
    .map(
      ([platform, url]) =>
        '<li><a href="' + url + '">' + labels[platform] + "</a></li>",
    )
    .join("");
  return (
    '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Upscayl · 홈 서버</title>' +
    "<style>:root{color-scheme:light dark;--ink:light-dark(#18231e,#e7eee9);--bg:light-dark(#fafbf8,#151a16);--line:light-dark(#d3dcd2,#3c443f);--link:light-dark(#1d6440,#92debd)}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,sans-serif}main{max-width:50rem;margin:4rem auto;padding:0 1.5rem}header{display:flex;align-items:baseline;gap:1rem}h1{font-size:2.5rem;letter-spacing:-.05em;margin:0}h2{font-size:1.25rem;margin:.2rem 0 .6rem}h3{font-size:1rem;margin:1rem 0 .25rem}section{border-top:1px solid var(--line);padding:1.2rem 0}pre{border-left:3px solid var(--link);padding:.5rem 1rem;overflow:auto}a{color:var(--link);text-underline-offset:.2em}ul{padding-left:1.3rem}footer{border-top:1px solid var(--line);padding-top:1rem;display:flex;gap:1rem;flex-wrap:wrap}</style>" +
    '<main><a href="/app">← Upscayl</a><header><h1>Upscayl</h1><span>v' +
    info.version +
    "</span></header><p>같은 공유기의 PC에서 이 맥의 GPU로 이미지를 업스케일합니다.</p>" +
    pwa +
    '<section><h2>에이전트 연결</h2><p>홈 서버 주소를 에이전트에 전달하세요. 연결 설정과 다운로드 목록은 <a href="/manifest.json">manifest.json</a>에서 읽을 수 있습니다.</p>' +
    "<h3>Codex</h3><pre>" +
    info.codex +
    "</pre><h3>OpenCode</h3><p>기존 설정에 아래 항목을 병합하세요.</p><pre>" +
    JSON.stringify(info.opencode, null, 2) +
    "</pre></section>" +
    '<section><h2>공용 스킬</h2><p><a href="' +
    info.skill +
    '">Codex·OpenCode용 스킬 ZIP</a>을 개인 <code>~/.agents/skills</code>에 풉니다. CLI를 설치했다면 <code>upscayl-mcp skill install</code>을 실행해도 됩니다.</p></section>' +
    "<section><h2>CLI · MCP 서버 다운로드</h2><p>ZIP 하나에 CLI와 서버가 함께 들어 있습니다. GPU와 Upscayl 앱은 호스트 맥에서 사용합니다.</p><ul>" +
    links +
    "</ul></section>" +
    '<footer><a href="' +
    info.checksums +
    '">SHA256 체크섬</a><a href="' +
    info.repository +
    '">GitHub 저장소</a></footer></main></html>'
  );
}
