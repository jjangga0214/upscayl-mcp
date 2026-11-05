# Run the home LAN service

On macOS, Windows or Linux with a compatible Upscayl installation, start a foreground server with `upscayl-mcp server run`. Share the printed URL. Stop it with Ctrl+C. To run it in the background on Windows or Linux, launch this command using your own service manager.

## macOS launchd controls

    upscayl-mcp server status
    upscayl-mcp server start
    upscayl-mcp server stop
    upscayl-mcp server autostart on
    upscayl-mcp server autostart off

Start and stop control the running service. Autostart controls the next macOS user login through launchd. Check `running`, `autostart` and `url` in status. For another PC, give the reported LAN URL. Its browser opens the app, and its agent can discover the client skill and MCP connection from the same address.

## Choose the address

By default the service binds the active private IPv4 on port 8765. To customize an existing service, finish active jobs and stop it first. For example, if the host owns 192.168.50.20 and every client resolves studio.home.arpa to it:

    upscayl-mcp server run --host 192.168.50.20 --domain studio.home.arpa --port 9080

Substitute the operator's addresses. `--host` selects the host’s network interface; `--host auto` restores automatic selection. `--domain` selects the hostname advertised to clients. Set up local DNS (or client hosts entries) separately. Omit the domain on first use to share the IP, or pass `--domain ''` to clear a saved name. HTTP on the bind IP also serves discovery. Use the configured name for HTTPS. On macOS, pass the same options to `server start` for a managed launchd service. A managed start saves settings for later starts and login in the user’s Library/Application Support/upscayl-mcp/service.json.

## Configure HTTPS and certificate trust

Provide a PEM certificate chain and its matching private key. The leaf certificate must include the advertised DNS name in a DNS SAN, or the actual IP in an IP SAN when sharing an IP. Use an existing certificate for that name, or issue one with your private CA. For example, with mkcert installed, `mkcert -cert-file lan.pem -key-file lan-key.pem studio.home.arpa` issues a certificate for that name; the public root is `rootCA.pem` in the directory printed by `mkcert -CAROOT`. Keep the CA key on its issuing machine.

    upscayl-mcp server run --host 192.168.50.20 --domain studio.home.arpa --port 9080 \
      --https-port 9443 --tls-cert /path/to/fullchain.pem --tls-key /path/to/key.pem \
      --tls-ca /path/to/public-root.pem

Substitute the operator’s paths. The HTTPS port defaults to HTTP port + 1. Omit `--tls-ca` when the clients already trust the issuer, or pass `--tls-ca ''` to remove a previously shared root. `--http-only` clears saved HTTPS settings. Legacy `UPSCAYL_TLS_CERT`, `UPSCAYL_TLS_KEY`, `UPSCAYL_TLS_CA` and `UPSCAYL_TLS_PORT` environment variables also work; explicit options take precedence.

Give clients the HTTP or HTTPS URL printed at startup or shown in macOS service status. `/setup`, `/llms.txt` and `/manifest.json` publish this installation’s addresses and optional public CA download. Share the CA fingerprint printed at startup (also `ca_sha256` in macOS service status) separately so clients can verify the downloaded certificate before trusting it. Renew an expired certificate or reissue it for a changed hostname/IP. Inspect the log path from status if startup fails; use `upscayl-mcp models` to check engine discovery. Keep this unauthenticated service on the trusted LAN.

Web and MCP jobs use temporary server storage. Completed, failed and cancelled jobs expire after five minutes, and downloads do not reset that deadline. Unused uploads expire after five minutes. Restarting the service invalidates job IDs, so let active jobs and downloads finish before a planned restart.
