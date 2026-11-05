# CLI

Use `upscayl-mcp --help` or command-specific `--help`. On Windows the release executable ends in .exe. The host requires Upscayl Desktop on macOS. The remote CLI works without the app, GPU or Bun.

    upscayl-mcp compare "original.png" "result.png"
    upscayl-mcp models
    upscayl-mcp upscale "portrait.jpg" --format webp --scale 2
    upscayl-mcp upscale "poster.png" --model digital-art-4x --width 2400 --explain
    upscayl-mcp upscale "scan.png" --double --output "large.png"
    upscayl-mcp upscale "./photos" --output-dir "./results" --format jpg
    upscayl-mcp upscale "photo.png" --server http://HOST:8765 --output "result.png"

Supported inputs are PNG, JPEG (including .jpeg and .jfif), and WebP. --output selects the exact single-image path. Its extension selects the format unless --format is supplied, in which case both must agree. --output-dir chooses the parent for desktop-style names. Batch outputs go into a model/scale-specific child folder. --json prints machine-readable results. --explain describes processing without running the GPU; for a remote image it uploads the source to inspect it.

    upscayl-mcp server start
    upscayl-mcp server status
    upscayl-mcp server stop
    upscayl-mcp server autostart on
    upscayl-mcp server autostart off
    upscayl-mcp server run --host 127.0.0.1 --port 8766

On the Mac, start and stop control the current service. Autostart controls the next user login with launchd. The default host follows the primary private LAN IPv4 and the default port is 8765. Use --host and --port with start/autostart to configure them. Stop before changing a running service's address. During sleep the Mac is unavailable. No account or token is required on this trusted LAN.

Install the shared skill with `upscayl-mcp skill install`, or extract the server's skill ZIP into your personal .agents/skills directory. The installed folder is upscayl/.
