# upscayl-mcp

**English** · [한국어](README.ko.md)

Run Upscayl locally or share the host’s GPU with devices on your home LAN. Use the browser, the CLI, or any MCP client that supports Streamable HTTP. Only the host needs Upscayl Desktop and a compatible GPU. [Upscayl Desktop](https://github.com/upscayl/upscayl)

## Choose an optional agent skill

| Where the agent runs | Skill | What it does |
|---|---|---|
| A device connecting to the host | `upscayl` | Upload images over the LAN, run jobs through MCP and save results on this device. The remote CLI is also available for shell scripts and batches. |
| The computer with Upscayl installed | `upscayl-host` | Run the local engine, serve the LAN, configure HTTPS and manage startup at login on macOS. |

Give a client agent the host's IP address or domain and port. The guide at `/llms.txt` and the manifest at `/manifest.json` point it to the client skill by default. An agent that supports `SKILL.md` can use the self-contained ZIP for its role. Install with `upscayl-mcp skill install` on a client or add `--role host` on the host. The default parent directory is `~/.agents/skills/`, used by Codex and OpenCode. Pass `--dir PATH` for another agent’s skills directory. MCP also works directly with the advertised URL. [Client skill](skills/upscayl/SKILL.md) · [Host skill](skills/upscayl-host/SKILL.md)

If you installed the older combined skill, the default install command updates its official files to the client version. The installer identifies locally edited files for review. The host skill installs in its own directory, so you can use both roles. To keep only the host skill on a host that had the combined version, install the host skill and move the old `upscayl` directory outside your global skills directory.

## Install the CLI and upscale locally

Install Upscayl Desktop on the host. Download the ZIP for your operating system and CPU, verify it against the release's `SHA256SUMS`, extract it and put the executable on your `PATH`. The release binaries include their runtime. Source builds use Bun (tested with 1.4.2). To run from source, use `bun install --frozen-lockfile`, then `bun src/cli.ts --help`. [GitHub Releases](https://github.com/jjangga0214/upscayl-mcp/releases)

```sh
upscayl-mcp models
upscayl-mcp upscale "photo.png"
upscayl-mcp upscale "photo.png" --scale 2 --format webp
upscayl-mcp upscale "./photos" --output-dir "./results"
upscayl-mcp compare "photo.png" "photo_upscayl_4x_upscayl-standard-4x.png"
```

The CLI looks for the installed desktop engine and models. Set `UPSCAYL_APP` for a custom location. It accepts a macOS app bundle, a Windows or Linux installation folder, or its resources directory containing `bin/` and `models/`. For an AppImage, point it to an extracted installation. Local GPU upscaling and foreground hosting have been verified on macOS. Windows and Linux package discovery is implemented, but GPU operation on those systems is unverified.

The CLI follows **Upscayl Desktop 2.15.0** processing behavior and manages its settings independently of the desktop GUI. You can process single images or folders, use built-in or custom models, request a scale from 1–16 or a target width, and use Double Upscayl. Output options include PNG, JPG, WebP, compression, GPU selection, tile size and test-time augmentation (TTA). Use `--explain` to inspect the processing plan or `compare` to view the original and result together. [How the options affect the output](skills/upscayl/references/behavior.md)

## Run a home server

Start the foreground service on a host with a working local Upscayl engine. Share the URL it prints and use Ctrl+C to stop it.

```sh
upscayl-mcp server run
```

On macOS you can also manage a background service with launchd.

```sh
upscayl-mcp server start
upscayl-mcp server autostart on
upscayl-mcp server status
```

For a launchd service, share the `url` from `server status`. In a browser, it opens the image canvas. The **Setup** page at `/setup` provides connection instructions and downloads. Agents can fetch the same configuration from `/manifest.json`.

The server includes both skills. To serve CLI downloads directly over the LAN, place the release archives and `SHA256SUMS` beside the host executable, or point `UPSCAYL_DIST` at their directory. If an archive is missing, its download link points to the matching GitHub release.

On macOS, use `server start` and `server stop` for the managed service. Use `server autostart on` or `off` to control the macOS LaunchAgent at the next login. On other systems you can launch `server run` with your own service manager. The host must be awake. By default the server listens on its active private IPv4 address on port 8765. Use `--host <LAN-IP> --port <PORT>` to change it. A DHCP reservation on your router keeps the address stable across restarts.

The service is designed for a trusted home LAN and runs without authentication. Keep router port forwarding disabled for the service. The server checks the request hostname and browser origin. Remote clients reference files by upload ID. Each upload is limited to 32 MiB. Images, including intermediate outputs, are limited to 96 megapixels and 32,768 pixels per side.

## Web app and PWA

Drop an image onto the canvas, select a file or open a folder. The model picker shows descriptions and official before-and-after examples. On desktop, use the left sidebar for settings. On mobile, **Settings** in the upper right opens a panel from the top. Start a job there, or swipe its bottom handle up or tap Close to return to the full-width canvas. Once you select an image, the bottom action lets you upscale, follow progress and save the result. Multiple results can be saved as a ZIP.

In the preview or fullscreen view, pinch to zoom, drag to pan, or drag the divider to compare the same detail in the original and result. Tap **Fit** to see the whole image again. The app uses React, HeroUI and Tailwind CSS. At startup, the server reads the official icon, fonts, desktop version and built-in model examples from the installed app. Custom models appear under their installed names.

The web app and setup guide follow the browser's language preferences and fall back to English. Agent skills use English by default and respond in Korean to Korean requests or an explicit Korean preference.

| To open | Path | What the root URL returns |
|---|---|---|
| Web app | `/app` | The app for ordinary browser navigation |
| Agent guide | `/llms.txt` | Markdown for ordinary terminal requests, or an HTML setup guide for recognized agents requesting HTML |
| Configuration manifest | `/manifest.json` | JSON when requested with `Accept: application/json` |

Use the explicit path when a client sends the same headers as a browser. The PWA caches the app shell, fonts and icons for offline use. Upscaling requires a connection to the host.

### Configure the server address and certificates

Choose values for your network. `--host` is a private IPv4 address assigned to the host. `--domain` is the name clients will use. If you choose a domain, configure your router's DNS or each client's hosts file to resolve it to the host's address. The addresses, ports and file paths below are examples. When running from source, replace `upscayl-mcp` with `bun src/cli.ts`.

```sh
upscayl-mcp server run --host 192.168.50.20 --domain studio.home.arpa --port 9080 \
  --https-port 9443 --tls-cert /path/to/fullchain.pem --tls-key /path/to/key.pem \
  --tls-ca /path/to/public-root.pem
```

This example serves HTTP at `http://studio.home.arpa:9080` and the PWA at `https://studio.home.arpa:9443`. The setup page and agent guide use your configured address in MCP commands and skill download links. For a macOS managed service, stop it and pass these options to `server start`. Its settings apply to future starts and login sessions. Stop the service before changing them. Use `--host auto` to restore automatic address selection or `--domain ''` to clear a saved domain.

- **HTTP.** Omit the certificate options for an HTTP-only setup. Use `--http-only` to clear a previous HTTPS configuration. To install the PWA over the LAN, open an HTTPS address the device trusts.
- **HTTPS.** Supply a certificate chain and matching private key. The certificate's subject alternative names must include the DNS name or IP address that clients use. The HTTPS port defaults to the HTTP port plus one. You can use an existing certificate or issue one with your own CA. For example, with mkcert installed, run `mkcert -cert-file lan.pem -key-file lan-key.pem studio.home.arpa`.
- **Distributing a CA certificate.** Pass the public root certificate with `--tls-ca` to publish its download URL and SHA-256 fingerprint in `/setup`, `/llms.txt` and `/manifest.json`. For mkcert, the file is `rootCA.pem` in the directory printed by `mkcert -CAROOT`. Before trusting a downloaded CA, compare its fingerprint with the value printed at host startup or shown by macOS `server status`. You can omit the CA if devices already trust the issuer. Use `--tls-ca ''` to remove a previously published CA.
- **Environment variables.** The server also accepts `UPSCAYL_TLS_CERT`, `UPSCAYL_TLS_KEY`, `UPSCAYL_TLS_CA` and `UPSCAYL_TLS_PORT`. Command-line options take precedence. Restart the service after renewing certificates.

## Connect from another device

The host does the GPU work. The client only needs network access. Give its agent the server address and ask it to read the setup guide and upscale your image. Register the manifest’s `mcp` URL in your client using Streamable HTTP. The Codex command below is one example. Files travel in separate HTTP requests, keeping image bytes out of the agent's prompt.

```sh
codex mcp add upscayl --url http://HOST:8765/mcp
upscayl-mcp upscale "photo.png" --server http://HOST:8765 --output "big.png"
upscayl-mcp skill install
```

For OpenCode, merge `{"upscayl":{"type":"remote","url":"http://HOST:8765/mcp","enabled":true,"oauth":false}}` into the `mcp` section of your existing configuration. The default client skill path is `~/.agents/skills/upscayl`. [MCP setup and workflow](skills/upscayl/references/mcp.md) · [Remote CLI](skills/upscayl/references/cli.md)

## Development and verification

```sh
bun install --frozen-lockfile
bun run check
bun test
bun run release:build
```

On a host with the default model and a working GPU, the tests run the GPU engine. They compare PNG, JPEG and WebP output bytes against the engine invoked with desktop arguments and exercise upload through download using an MCP SDK client. The release build uses Bun and `zip` to write platform archives, two role-specific skill ZIPs and `SHA256SUMS` to `dist/`.

This independent integration is distributed under the MIT license. The engine and models come from the host's Upscayl installation and retain their respective licenses. [License](LICENSE) · [Upscayl engine](https://github.com/upscayl/upscayl-ncnn) · [Desktop argument builder](https://github.com/upscayl/upscayl/blob/v2.15.0/electron/utils/get-arguments.ts)

## How long files are kept

The web app and MCP use the same server cache. The server schedules job files for deletion five minutes after completion, failure or cancellation. Checking status or downloading again keeps the original deadline. An unused upload expires five minutes after upload. If several jobs share an upload, it stays available until the last job's deadline.

Once the browser has received a result, it stays in the tab's memory for comparison and saving even after the server copy expires. Download anything you want to keep before closing the tab. Files saved by the local CLI or downloaded to a client stay on that device.

The legacy sample URLs serve a reduced public-domain National Park Service photo of Mount Rainier and its actual Upscayl Standard 4× output. [Original photograph](https://commons.wikimedia.org/wiki/File:Mount_Rainier_and_lake_reflection.jpg)
