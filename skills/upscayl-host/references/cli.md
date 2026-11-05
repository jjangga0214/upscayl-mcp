# Local CLI

The CLI uses the installed Upscayl.app engine and model files on the Mac. Set `UPSCAYL_APP` for an alternative app bundle or `UPSCAYL_MODELS_DIR` for custom model pairs. List installed model IDs before selecting one.

    upscayl-mcp models
    upscayl-mcp upscale "portrait.jpg" --format webp --scale 2
    upscayl-mcp upscale "poster.png" --model digital-art-4x --width 2400 --explain
    upscayl-mcp upscale "scan.png" --double --output "large.png"
    upscayl-mcp upscale "./photos" --output-dir "./results" --format jpg
    upscayl-mcp compare "original.png" "result.png"

Input formats are PNG, JPEG and WebP. For a single image, `--output` sets the destination and its extension selects the format. For a folder, `--output-dir` sets the parent of the generated results folder. `--json` prints machine-readable results. Local CLI outputs are regular files on the Mac. Use the per-command `--help` for the full option list.

A regular single-image run can reuse an existing decodable destination. Use `--overwrite` to replace it after changing settings. Batch and Double refresh generated output names. Each completed batch file remains available if the run is interrupted.
