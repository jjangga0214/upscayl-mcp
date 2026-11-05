# Run the home LAN service

    upscayl-mcp server status
    upscayl-mcp server start
    upscayl-mcp server stop
    upscayl-mcp server autostart on
    upscayl-mcp server autostart off

Start and stop control the running service. Autostart controls the next macOS user login through launchd. Check `running`, `autostart` and `url` in status. For another PC, give the reported LAN URL. Its browser opens the app, and its agent can discover the client skill and MCP connection from the same address.

The default is the active private IPv4 and port 8765. To change a running service's binding, stop it and then start with `--host <LAN-IP> --port <PORT>`. For foreground diagnostics use `upscayl-mcp server run --host 127.0.0.1 --port 8766`. During sleep the Mac is unavailable. If startup fails, read the log path returned by status, check the LAN address, and verify local engine discovery with `upscayl-mcp models`.

For installable PWA access from another device, provide a certificate covering the LAN IP and its private key when starting the service. `UPSCAYL_TLS_CERT` and `UPSCAYL_TLS_KEY` are paths. Optionally set `UPSCAYL_TLS_CA` to the **public** CA certificate and `UPSCAYL_TLS_PORT` for a separate HTTPS port (default HTTP port + 1). Status reports the PWA URL and configured CA fingerprint. Compare the fingerprint before trusting that CA on a client device. Keep the unauthenticated service on the trusted LAN.

Web and MCP jobs use temporary server storage. Completed, failed and cancelled jobs expire after five minutes, and downloads do not reset that deadline. Unused uploads expire after five minutes. Restarting the service invalidates job IDs, so let active jobs and downloads finish before a planned restart.
