import { t } from "./language";
import { useState, type ReactNode } from "react";
import { Icon } from "./icons";
import { ModelPicker, type Model } from "./models";
import type { Options } from "../engine";

function Choices({
  label,
  list,
  value,
  change,
}: {
  label: string;
  list: [string, string][];
  value: string;
  change: (v: string) => void;
}) {
  return (
    <div className="choices" role="group" aria-label={label}>
      {list.map(([id, name]) => (
        <button
          key={id}
          type="button"
          aria-pressed={id === value}
          onClick={() => change(id)}
        >
          {name}
        </button>
      ))}
    </div>
  );
}
type Props = {
  models: Model[];
  count: number;
  batch: boolean;
  busy: boolean;
  online: boolean;
  run: (options: Options) => void;
  children: ReactNode;
};
export function Settings({
  models,
  count,
  batch,
  busy,
  online,
  run,
  children,
}: Props) {
  const [model, setModel] = useState("upscayl-standard-4x"),
    [scale, setScale] = useState("4"),
    [units, setUnits] = useState("scale"),
    [format, setFormat] = useState("png"),
    [double, setDouble] = useState(false);
  const actualModel =
    models.length && !models.some((m) => m.id === model) ? models[0].id : model;
  const num = (form: FormData, key: string) => Number(form.get(key));
  return (
    <form
      className="settings"
      onSubmit={(e) => {
        e.preventDefault();
        if (!count || busy || !online) return;
        const data = new FormData(e.currentTarget);
        const gpu = String(data.get("gpu") || "").trim();
        run({
          model: actualModel,
          scale:
            scale === "custom"
              ? units === "scale"
                ? num(data, "custom")
                : 4
              : Number(scale),
          width:
            scale === "custom" && units === "width"
              ? num(data, "custom")
              : undefined,
          format: format as Options["format"],
          double: double && !batch,
          compression: num(data, "compression"),
          tile: num(data, "tile"),
          tta: data.has("tta"),
          gpu: gpu || undefined,
        });
      }}
    >
      <fieldset disabled={busy}>
        <ModelPicker
          models={models}
          disabled={busy}
          value={actualModel}
          change={setModel}
        />
        <section>
          <h2>{t("Output size")}</h2>
          <Choices
            label={t("Output scale")}
            list={[
              ["2", "2×"],
              ["4", "4×"],
              ["8", "8×"],
              ["custom", t("Custom")],
            ]}
            value={scale}
            change={setScale}
          />
          {scale === "custom" && (
            <div className="form-row mt-3">
              <label>
                {t("Size by")}
                <select
                  value={units}
                  onChange={(e) => setUnits(e.target.value)}
                >
                  <option value="scale">{t("Scale")}</option>
                  <option value="width">{t("Width")}</option>
                </select>
              </label>
              <label>
                {units === "width" ? t("Width (px)") : t("Scale")}
                <input
                  key={units}
                  name="custom"
                  type="number"
                  min="1"
                  max={units === "width" ? 65535 : 16}
                  defaultValue={units === "width" ? 1920 : 3}
                  required
                />
              </label>
            </div>
          )}
          <label className="switchrow">
            <span>Double Upscayl</span>
            <input
              type="checkbox"
              role="switch"
              checked={!batch && double}
              disabled={batch}
              onChange={(e) => setDouble(e.target.checked)}
            />
          </label>
        </section>
        <section>
          <h2>{t("Output format")}</h2>
          <Choices
            label={t("Output format")}
            value={format}
            change={setFormat}
            list={[
              ["png", "PNG"],
              ["jpg", "JPG"],
              ["webp", "WebP"],
            ]}
          />
        </section>
        <details>
          <summary>
            <Icon name="settings" />
            {t("Advanced settings")}
            <Icon name="chevron" />
          </summary>
          <div className="advanced">
            <div className="form-row">
              <label>
                {t("Compression (0–100)")}
                <input
                  type="number"
                  name="compression"
                  defaultValue="0"
                  min="0"
                  max="100"
                  required
                />
              </label>
              <label>
                {t("Tile size")}
                <input
                  type="number"
                  name="tile"
                  defaultValue="0"
                  min="0"
                  max="8192"
                  required
                  onChange={(e) => {
                    const n = e.target.valueAsNumber;
                    e.target.setCustomValidity(
                      n > 0 && n < 32
                        ? t("Enter 0 for automatic or at least 32.")
                        : "",
                    );
                  }}
                />
              </label>
            </div>
            <label>
              GPU ID
              <input
                name="gpu"
                placeholder={t("Auto")}
                pattern="[0-9]+(,[0-9]+)*"
              />
            </label>
            <label className="switchrow">
              <span>{t("TTA mode")}</span>
              <input name="tta" type="checkbox" role="switch" />
            </label>
          </div>
        </details>
      </fieldset>
      {children}
    </form>
  );
}
