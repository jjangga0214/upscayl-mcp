# upscayl-mcp

맥에 설치된 [Upscayl Desktop](https://github.com/upscayl/upscayl)의 엔진과 모델을 CLI, Codex, OpenCode에서 사용합니다. 같은 집의 다른 PC에서는 맥의 LAN 주소로 이미지를 보내고 결과를 내려받습니다. 호스트는 macOS, 원격 CLI는 macOS·Windows·Linux를 지원합니다.

## 설치와 첫 실행

[GitHub Releases](https://github.com/jjangga0214/upscayl-mcp/releases)에서 운영체제와 CPU에 맞는 ZIP을 받아 압축을 풉니다. 실행 파일을 PATH에 넣으면 아래 명령을 그대로 쓸 수 있습니다. 릴리스의 SHA256SUMS로 압축 파일을 검증할 수 있습니다. 소스에서 실행하려면 Bun으로 `bun install --frozen-lockfile` 후 `bun src/cli.ts --help`를 실행합니다.

```sh
upscayl-mcp models
upscayl-mcp upscale "photo.png"
upscayl-mcp upscale "photo.png" --scale 2 --format webp
upscayl-mcp upscale "./photos" --output-dir "./results"
upscayl-mcp compare "photo.png" "photo_upscayl_4x_upscayl-standard-4x.png"
```

호스트에는 Upscayl.app이 필요합니다. CLI가 앱의 번들 엔진과 모델을 찾아 실행합니다. 호환 동작 기준은 **Desktop 2.15.0**이며 사용자의 GUI 설정은 독립적으로 관리됩니다. 단일·폴더 확대, 내장·사용자 모델, 출력 배율 1–16, 목표 너비, Double Upscayl, PNG/JPG/WebP, 압축, GPU·타일·TTA를 지원합니다. 적용 과정을 보려면 `--explain`, 전후 비교는 `compare`를 사용합니다. [인자별 동작과 차이](skills/upscayl/references/behavior.md)

## 맥을 홈 서버로 사용하기

```sh
upscayl-mcp server start
upscayl-mcp server autostart on
upscayl-mcp server status
```

`status`에 나오는 **http://IP:포트/** 주소를 다른 PC의 에이전트에게 전달하세요. 이 주소는 연결 방법, 현재 버전의 스킬 ZIP, 플랫폼별 CLI와 MCP 서버 ZIP을 제공합니다. `/manifest.json`은 같은 정보의 기계 판독용 버전입니다. 압축 파일과 SHA256SUMS를 호스트 실행 파일 옆에 두거나 UPSCAYL_DIST에 해당 폴더를 지정하면 LAN에서 직접 내려받을 수 있습니다. 없는 실행 파일은 같은 버전 GitHub Release로 연결합니다. 스킬은 서버에 내장되어 있습니다.

`server start/stop`은 현재 실행 상태, `server autostart on/off`는 다음 사용자 로그인 시의 동작을 바꿉니다. LaunchAgent는 로그인 후 실행됩니다. 맥이 잠들면 작업 요청도 대기해야 합니다. 기본 포트는 8765이며 맥의 활성 사설 IPv4에 바인딩합니다. 주소나 포트를 바꾸려면 먼저 중지하고 `server start --host <LAN-IP> --port <PORT>`를 사용합니다. 공유기의 DHCP 예약을 쓰면 재부팅 후에도 같은 주소를 전달할 수 있습니다.

인증 없이 쓰는 신뢰된 홈 LAN 전용입니다. 지정한 숫자 IP의 Host와 브라우저 Origin을 확인합니다. 공유기 포트포워딩으로 인터넷에 공개하지 마세요. 원격 요청은 업로드 ID로만 파일을 지정합니다. 실행 중인 서버가 받는 최대 입력은 32 MiB, 중간 이미지 포함 한 장의 최대 크기는 96 MP·한 변 32,768픽셀입니다.

## 다른 PC의 Codex·OpenCode 또는 CLI

원격 PC에는 Upscayl이나 GPU가 필요 없습니다. 에이전트에게 “이 주소에서 Upscayl 연결 방법을 읽고 이 사진을 확대해 줘”라고 요청합니다. MCP는 Streamable HTTP를 사용합니다. 사진은 별도 HTTP 요청으로 보내므로 원본이나 결과의 Base64가 프롬프트를 차지하지 않습니다.

```sh
codex mcp add upscayl --url http://HOST:8765/mcp
upscayl-mcp upscale "photo.png" --server http://HOST:8765 --output "big.png"
upscayl-mcp skill install
```

OpenCode는 기존 설정의 mcp 아래에 `{"upscayl":{"type":"remote","url":"http://HOST:8765/mcp","enabled":true,"oauth":false}}`를 병합합니다. 글로벌 스킬은 `~/.agents/skills/upscayl` 한 곳에 설치합니다. [MCP 연결과 작업 흐름](skills/upscayl/references/mcp.md) · [CLI 사용법](skills/upscayl/references/cli.md)

## 개발과 검증

```sh
bun install --frozen-lockfile
bun run check
bun test
bun run release:build
```

맥에 기본 모델이 설치되어 있으면 테스트가 실제 GPU로 실행됩니다. 앱과 같은 인자로 생성한 PNG/JPEG/WebP와 래퍼의 결과 바이트를 비교하고, SDK 클라이언트에서 서버에 연결해 파일 업로드부터 결과 다운로드까지 확인합니다. `release:build`는 Bun과 zip을 사용해 dist에 각 플랫폼의 ZIP, 스킬 ZIP, SHA256SUMS를 생성합니다.

이 저장소는 독립적인 통합 도구입니다. Upscayl 본체와 모델은 호스트의 앱 설치본에서 사용하며 각각의 원래 라이선스를 따릅니다. [공식 엔진](https://github.com/upscayl/upscayl-ncnn) · [공식 앱 인자 구성](https://github.com/upscayl/upscayl/blob/v2.15.0/electron/utils/get-arguments.ts)
