---
name: upscayl
description: Enlarge, enhance or batch-process local images with the installed Upscayl desktop engine or a home LAN Upscayl MCP server. Use for requests such as 사진 확대, 이미지 업스케일, Double Upscayl and exact output width.
---

# Upscayl

Use the same engine and model files as Upscayl Desktop on the host Mac. Keep the input and write the requested result where the user can open it.

- On the Mac, use `upscayl-mcp upscale "photo.png"` (Standard 4× PNG). A folder selects desktop batch mode. See [CLI](references/cli.md) for paths, formats, overwrite, remote CLI and service control.
- On another computer, start at the supplied `http://IP:port/`. Read its manifest, then use the connected MCP or download its client. Upload the local file before processing and download the result to the requesting computer. See [MCP](references/mcp.md).
- For questions about models, scale, Double, width or quality, see [desktop behavior](references/behavior.md). Use `--explain` or `explain_upscale` to report the plan for the actual image. Use the user's requested model and settings. Report the saved result and its dimensions.
