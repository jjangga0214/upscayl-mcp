---
name: upscayl-host
description: Use the local Upscayl engine or operate the Upscayl LAN service on its host Mac. Use for local CLI upscaling, 서버 시작·중지, 로그인 자동 시작, HTTPS setup or troubleshooting the host.
---

# Upscayl host

Use English for user-facing replies by default. Use Korean when the user writes in Korean or has an explicit Korean language preference. Follow an explicit request for a response language. Keep commands, file paths and model IDs verbatim.

For an image on the host Mac, run `upscayl-mcp upscale "photo.png"` directly with the installed desktop engine. Local processing works while the LAN service is stopped.

- For models, files, folders, output paths and local comparison, read [local CLI](references/cli.md).
- To configure this Mac’s LAN IP, DNS name, ports, TLS certificate or public CA, or to manage startup, logs and temporary files, read [host operations](references/server.md). Give another PC the URL reported by `upscayl-mcp server status`.
- For the effect of a model or option, read [output behavior](references/behavior.md). Run `upscayl-mcp upscale "photo.png" --explain` for the actual processing plan.
