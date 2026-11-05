# upscayl-mcp

[English](README.md) · **한국어**

맥에 설치된 [Upscayl Desktop](https://github.com/upscayl/upscayl)의 엔진과 모델을 CLI, Codex, OpenCode에서 사용합니다. 같은 집의 다른 PC에서는 맥의 LAN 주소로 이미지를 보내고 결과를 내려받습니다. 호스트는 macOS, 원격 CLI는 macOS·Windows·Linux를 지원합니다.

## Codex·OpenCode 스킬 선택

| 사용하는 기기 | 스킬 | 역할 |
|---|---|---|
| 연결할 PC | `upscayl` | MCP로 사진을 보내고 이 PC에 저장합니다. 터미널·배치 스크립트에는 원격 CLI를 선택할 수 있습니다. |
| Upscayl이 설치된 맥 | `upscayl-host` | 로컬 CLI로 직접 처리하고 LAN 서비스·로그인 자동 시작·HTTPS를 관리합니다. |

다른 PC의 에이전트에는 호스트의 IP 또는 도메인과 포트가 포함된 주소를 전달하세요. `/llms.txt`와 `/manifest.json`의 기본 스킬은 클라이언트용입니다. 기기별 ZIP은 각각 자체 참조 문서를 포함하며 Codex와 OpenCode가 함께 읽는 `~/.agents/skills/`에 설치합니다. CLI가 있으면 클라이언트는 `upscayl-mcp skill install`, 호스트 맥은 `upscayl-mcp skill install --role host`로 설치합니다. [클라이언트 스킬](skills/upscayl/SKILL.md) · [호스트 스킬](skills/upscayl-host/SKILL.md)

기존 통합 스킬을 사용한 PC에서 기본 설치 명령을 실행하면 공식 배포 파일을 클라이언트용으로 갱신합니다. 수정한 파일이 있으면 검토할 경로를 알려줍니다. 호스트 설치 명령은 별도 폴더에 설치하므로 두 역할을 함께 둘 수도 있습니다. 기존 통합판을 사용한 맥에서 호스트 역할만 쓰려면 새 스킬 설치 후 이전 `upscayl` 폴더를 글로벌 스킬 경로 밖에 보관하세요.

## 호스트 CLI 설치와 첫 실행

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

`status`에 나오는 `url` 주소를 다른 PC의 에이전트에게 전달하세요. 브라우저에서는 파일을 끌어놓는 화면이 열립니다. 폴더를 열거나 사진을 선택한 뒤 업스케일하고 원본과 비교해 저장할 수 있습니다. AI 모델 선택창에서 모델 설명과 공식 전후 사진을 볼 수 있습니다. 여러 결과는 ZIP으로 저장합니다. 연결 방법과 다운로드는 **연결 및 설치**(`/setup`)에 있습니다. `/manifest.json`은 같은 정보의 기계 판독용 버전입니다. 압축 파일과 SHA256SUMS를 호스트 실행 파일 옆에 두거나 UPSCAYL_DIST에 해당 폴더를 지정하면 LAN에서 직접 내려받을 수 있습니다. 없는 실행 파일은 같은 버전 GitHub Release로 연결합니다. 스킬은 서버에 내장되어 있습니다.

`server start/stop`은 현재 실행 상태, `server autostart on/off`는 다음 사용자 로그인 시의 동작을 바꿉니다. LaunchAgent는 로그인 후 실행됩니다. 맥이 잠들면 작업 요청도 대기해야 합니다. 기본 포트는 8765이며 맥의 활성 사설 IPv4에 바인딩합니다. 주소나 포트를 바꾸려면 먼저 중지하고 `server start --host <LAN-IP> --port <PORT>`를 사용합니다. 공유기의 DHCP 예약을 쓰면 재부팅 후에도 같은 주소를 전달할 수 있습니다.

인증 없이 쓰는 신뢰된 홈 LAN 전용입니다. 바인딩 IP와 설정한 도메인에 대해서만 요청을 받고 브라우저 Origin을 확인합니다. 공유기 포트포워딩으로 인터넷에 공개하지 마세요. 원격 요청은 업로드 ID로만 파일을 지정합니다. 실행 중인 서버가 받는 최대 입력은 32 MiB, 중간 이미지 포함 한 장의 최대 크기는 96 MP·한 변 32,768픽셀입니다.

## 웹 앱과 PWA

영어와 한국어를 지원합니다. 웹 앱과 설치 안내는 브라우저의 언어 우선순위를 따르며, 지원 언어를 찾을 수 없으면 영어로 표시합니다. 에이전트는 한국어 요청이나 명시된 한국어 선호에 한국어로 답합니다.

웹 앱은 React, HeroUI, Tailwind CSS를 사용합니다. 데스크톱에서는 왼쪽 사이드바에서 설정을 바꾸고 오른쪽 캔버스에 이미지를 놓습니다. 모바일에서는 사진이 화면 너비를 모두 사용합니다. 오른쪽 위의 **설정**을 누르면 모델과 배율을 고르는 패널이 위에서 내려옵니다. 패널 아래쪽 손잡이를 위로 밀거나 닫기 버튼을 눌러 사진으로 돌아갈 수 있습니다. 사진을 고르면 하단에서 바로 업스케일하고 진행 상태를 보거나 결과를 저장할 수 있습니다. 설정 패널에서도 작업을 시작할 수 있습니다. 완료한 결과는 미리보기의 전체화면 버튼으로 볼 수 있습니다. 미리보기와 전체화면 모두에서 두 손가락으로 이미지를 확대하거나 축소할 수 있습니다. 확대한 사진을 한 손가락으로 옮기고, 비교선을 잡아 원본과 결과의 같은 부분을 비교하세요. **맞춤**을 누르면 사진 전체가 다시 보입니다. 서버가 실행될 때 호스트 앱에서 공식 아이콘, 브랜드 글꼴, 데스크톱 버전, 내장 모델 전후 사진을 읽습니다. 사용자 모델은 서버에 설치된 이름으로 선택합니다.

같은 루트 주소에서 일반 브라우저 탐색은 앱, 일반 터미널 요청은 Markdown 가이드, `Accept: application/json`은 설정 JSON을 받습니다. 알려진 에이전트가 HTML을 요청하면 설치 가이드를 받습니다. 요청 헤더가 브라우저와 같을 때는 구분이 어려우므로 `/app`, `/llms.txt`, `/manifest.json`으로 각각 직접 열 수 있습니다.

### 내 서버의 주소와 인증서 설정

소스에서 운영할 때는 아래 명령의 `upscayl-mcp`를 `bun src/cli.ts`로 바꾸세요. `--host`는 맥에 할당된 사설 IPv4, `--domain`은 다른 기기에서 접속할 DNS 이름입니다. 도메인을 쓰려면 공유기 DNS 또는 각 클라이언트의 hosts 파일에서 해당 이름이 맥의 IP를 가리키게 하세요. 아래 IP·도메인·포트·파일 경로는 예시입니다.

```sh
upscayl-mcp server stop
upscayl-mcp server start --host 192.168.50.20 --domain studio.home.arpa --port 9080 \
  --https-port 9443 --tls-cert /path/to/fullchain.pem --tls-key /path/to/key.pem \
  --tls-ca /path/to/public-root.pem
upscayl-mcp server status
```

이 예에서 HTTP 주소는 `http://studio.home.arpa:9080`, PWA 주소는 `https://studio.home.arpa:9443`입니다. 설치 화면과 에이전트 가이드는 운영자가 설정한 주소로 MCP 명령과 스킬 다운로드 링크를 생성합니다. `server start`로 지정한 값은 다음 실행과 로그인 자동 시작에도 적용됩니다. 기존 설정은 서비스를 중지한 뒤 변경하세요. `--host auto`는 IP를 자동 선택하고 `--domain ''`는 저장한 도메인을 지웁니다.

- **HTTP만 사용**하려면 인증서 옵션을 생략하세요. 기존 HTTPS 설정은 `--http-only`로 해제합니다. LAN에서 PWA를 설치하려면 기기가 신뢰하는 HTTPS 주소를 여세요.
- **HTTPS**에는 접속 도메인(DNS SAN) 또는 접속 IP(IP SAN)를 포함하는 인증서와 그에 맞는 개인 키가 필요합니다. HTTPS 포트 기본값은 HTTP 포트 + 1입니다. 이미 발급받은 인증서 체인을 쓰거나 사설 CA로 자신의 이름에 맞게 발급하세요. 예를 들어 mkcert가 설치되어 있다면 `mkcert -cert-file lan.pem -key-file lan-key.pem studio.home.arpa`를 실행할 수 있습니다.
- **공개 CA 배포**는 선택 사항입니다. `--tls-ca`에 공개 루트 인증서를 지정하면 `/setup`, `/llms.txt`, `/manifest.json`에 다운로드 주소와 SHA-256 지문이 나옵니다. mkcert의 공개 루트는 `mkcert -CAROOT`로 찾은 폴더의 `rootCA.pem`입니다. 클라이언트는 다운로드한 인증서의 지문을 운영자가 호스트의 `server status`로 확인한 값과 대조한 뒤 신뢰 등록하세요. 기기가 이미 발급 기관을 신뢰한다면 CA를 생략하고, 기존에 배포했던 CA를 제거하려면 `--tls-ca ''`를 사용하세요.
- 기존 환경 변수 `UPSCAYL_TLS_CERT`, `UPSCAYL_TLS_KEY`, `UPSCAYL_TLS_CA`, `UPSCAYL_TLS_PORT`도 지원합니다. 명령행 옵션이 있으면 그 값을 사용합니다. 인증서 갱신 후에는 서비스를 다시 시작하세요.

오프라인 캐시에는 앱 화면, 글꼴, 아이콘을 저장합니다. 업스케일을 실행하려면 호스트 연결이 필요합니다.

## 다른 PC의 Codex·OpenCode 또는 CLI

원격 PC에는 Upscayl이나 GPU가 필요 없습니다. 에이전트에게 “이 주소에서 Upscayl 연결 방법을 읽고 이 사진을 확대해 줘”라고 요청합니다. MCP는 Streamable HTTP를 사용합니다. 사진은 별도 HTTP 요청으로 보내므로 원본이나 결과의 Base64가 프롬프트를 차지하지 않습니다.

```sh
codex mcp add upscayl --url http://HOST:8765/mcp
upscayl-mcp upscale "photo.png" --server http://HOST:8765 --output "big.png"
upscayl-mcp skill install
```

OpenCode는 기존 설정의 mcp 아래에 `{"upscayl":{"type":"remote","url":"http://HOST:8765/mcp","enabled":true,"oauth":false}}`를 병합합니다. 클라이언트 스킬 위치는 `~/.agents/skills/upscayl`입니다. [MCP 연결과 작업 흐름](skills/upscayl/references/mcp.md) · [CLI 사용법](skills/upscayl/references/cli.md)

## 개발과 검증

```sh
bun install --frozen-lockfile
bun run check
bun test
bun run release:build
```

맥에 기본 모델이 설치되어 있으면 테스트가 실제 GPU로 실행됩니다. 앱과 같은 인자로 생성한 PNG/JPEG/WebP와 래퍼의 결과 바이트를 비교하고, SDK 클라이언트에서 서버에 연결해 파일 업로드부터 결과 다운로드까지 확인합니다. `release:build`는 Bun과 zip을 사용해 dist에 각 플랫폼의 ZIP, 역할별 스킬 ZIP 두 개, SHA256SUMS를 생성합니다.

이 저장소는 독립적인 통합 도구입니다. Upscayl 본체와 모델은 호스트의 앱 설치본에서 사용하며 각각의 원래 라이선스를 따릅니다. [공식 엔진](https://github.com/upscayl/upscayl-ncnn) · [공식 앱 인자 구성](https://github.com/upscayl/upscayl/blob/v2.15.0/electron/utils/get-arguments.ts)

## 작업 파일 보관

웹과 MCP가 사용하는 서버 캐시는 완료·실패·취소 시점부터 5분 후 예약 삭제합니다. 재조회나 다운로드로 시간이 연장되지 않습니다. 작업에서 사용하지 않은 업로드는 업로드 후 5분에 삭제되며, 여러 작업에서 같은 업로드를 사용할 때는 마지막 작업의 기한까지 유지됩니다. 결과는 브라우저 탭의 메모리로 받은 후 서버 만료와 관계없이 비교·저장할 수 있습니다. 탭을 닫기 전에 보관할 결과를 다운로드하세요. 로컬 CLI 또는 클라이언트가 직접 저장한 파일은 해당 기기에 남습니다.

이전 버전과 호환되는 샘플 주소의 사진은 [미국 국립공원관리청의 레이니어 산 사진](https://commons.wikimedia.org/wiki/File:Mount_Rainier_and_lake_reflection.jpg)을 축소한 이미지와 Upscayl Standard 4×의 실제 출력입니다. 사진은 퍼블릭 도메인입니다.
