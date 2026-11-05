---
name: upscayl
description: Upscale images on this device using a remote Upscayl MCP server on the home LAN. Use for 사진 업스케일, folder batches, Double Upscayl or connecting a client to a supplied server address.
---

# Upscayl client

Use the connected Upscayl MCP server. If the user supplies an IP and port, read its `/manifest.json` for the MCP endpoint and client setup. The requesting device owns the source and the saved result.

- For first-time connection, uploads, jobs and downloads, read [MCP workflow](references/mcp.md). Save the result on this device within five minutes of completion.
- For terminal use or batch scripts, the [remote CLI](references/cli.md) handles transfer, polling and saving with `--server`.
- For model choice, scale, width, Double or encoding, read [output behavior](references/behavior.md). Use `list_models` and `explain_upscale` for the actual installed model and image. Report the saved path and dimensions.
