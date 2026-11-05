# Remote CLI

For a shell workflow, download the client device's executable ZIP from the server manifest's `downloads` entry. The requesting device needs network access to the server. Use `upscayl-mcp.exe` on Windows.

    upscayl-mcp models --server http://HOST:PORT
    upscayl-mcp upscale "photo.png" --server http://HOST:PORT --output "photo-2x.webp" --scale 2
    upscayl-mcp upscale "./photos" --server http://HOST:PORT --output-dir "./results" --format jpg

Use the supplied server origin, including its scheme. A remote run uploads local PNG, JPEG or WebP data, waits for the host GPU and saves the result locally. The server schedules its copies for deletion five minutes after completion. A folder processes supported files directly inside it. `--explain` uploads the image to inspect its dimensions and returns the processing plan. `--json` gives script-friendly output.

For a single image, `--output` sets the local filename and its extension selects the format. For a folder, `--output-dir` selects the parent of the generated result folder. The original inputs are protected.

A regular single-image run can reuse an existing decodable destination. Use `--overwrite` to replace it after changing settings. Batch and Double refresh generated output names. Each completed batch file remains available if the run is interrupted.
