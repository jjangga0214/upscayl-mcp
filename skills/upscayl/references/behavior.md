# Upscayl Desktop processing

The reference is Upscayl Desktop v2.15.0. The wrapper runs the host's installed engine and discovers matching .param and .bin files. The app recognizes 2x/x2 and 3x/x3 in model names and otherwise assumes 4x. A misnamed custom model may fail dimension validation.

| Setting | What happens |
|---|---|
| Model | Standard is the general default. Lite prioritizes speed. High Fidelity emphasizes realistic detail and smooth textures. Digital Art handles illustrations. Remacri and UltraSharp add sharpness, and Ultramix Balanced balances sharpness and detail. The desktop labels the latter three non-commercial. List installed IDs before selecting one. |
| Scale (1–16) | Requested width and height multiplier per pass. The model runs at native scale. When requested and native scales differ, the engine resamples the model output. With a 4× model, ordinary 2× downsamples the 4× prediction and ordinary 8× enlarges it another 2×. Scale 1 still processes the image. |
| Double | Runs the model twice, taking the first encoded output as the next input. Without a width, scale 4 gives 16× total in each dimension. Both passes use the selected output format; JPEG intermediates can affect detail. The first pass uses engine defaults for compression and TTA. The app offers Double for single images. |
| Width | Overrides scale. The native engine derives height from the aspect ratio with integer division. In Double, the first pass uses native resolution and the final pass applies the requested width. |
| Format / compression | PNG (default), JPG or WebP, compression 0–100 following the desktop control. PNG compression preserves pixels. Lossy formats trade file size and detail and JPEG cannot carry alpha. |
| Tile / GPU | Tile 0 lets the engine choose, or specify at least 32. Smaller tiles may help GPU memory pressure. GPU IDs follow the native engine; leave unset to choose automatically. |
| TTA | Uses test-time augmentation to combine transformed predictions. This increases processing time; in Double the final pass receives the setting. |

Upstream references: [argument builder](https://github.com/upscayl/upscayl/blob/v2.15.0/electron/utils/get-arguments.ts), [Double](https://github.com/upscayl/upscayl/blob/v2.15.0/electron/commands/double-upscayl.ts), [model labels](https://github.com/upscayl/upscayl/blob/v2.15.0/renderer/locales/en.json).
