# Connect from another PC

For a bare IP:port, fetch `http://IP:port/manifest.json`. For a supplied HTTPS origin, keep HTTPS. Use the manifest's `mcp`, `uploads` and `skills.client.url` (or `skill`) URLs. Existing connections can start with `list_models`.

- For a new connection, use the manifest's `codex` command or merge its `opencode.mcp.upscayl` entry into the existing OpenCode MCP configuration. MCP uses Streamable HTTP. The client skill ZIP is self-contained and extracts to `~/.agents/skills/upscayl/`.
- Upload bytes as application/octet-stream: `curl --fail --data-binary "@photo.png" -H "Content-Type: application/octet-stream" http://IP:port/files`. Use curl.exe in Windows PowerShell. Read file_id from the JSON response.
- Use list_models or explain_upscale if needed. Call upscale with file_id and options, e.g. `{"file_id":"...","options":{"scale":2,"format":"png"}}`. For a batch call upscale_batch with file_ids and common options. Preserve the input order when mapping jobs to filenames.
- Poll get_job with job_id, initially once a second then less often during long runs. If done, GET the result path on the same server with curl --fail --output and verify dimensions locally. The finished job also includes a comparison path with a slider and lens; this URL lasts only until expires_at, so save results locally and compare local files for longer viewing. If failed, report the error. Use cancel_job to stop an unwanted job. Images travel as files, outside model context.
- The server schedules automatic deletion of job files, results and IDs five minutes after completion, failure or cancellation. Unused uploads expire five minutes after upload. Reads do not extend the deadline. A source shared by concurrent jobs is retained through the last job’s deadline. DELETE /jobs/{id} and DELETE /files/{id} can release copies sooner. A restart discards job IDs. Input files can be up to 32 MiB. Each intermediate image must fit within 96 megapixels and 32,768 pixels per side.
- For an ordinary remote file or folder, the remote CLI handles this entire upload, poll and save sequence with --server. Use this when MCP registration is unavailable or the user wants a shell command.

Use the server on the trusted home LAN.
