import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { inspect } from "./engine";

export function comparison(before: string, after: string) {
  const esc = (s: string) =>
    s
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;");
  return (
    '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Upscayl comparison</title>' +
    "<style>*{box-sizing:border-box}[hidden]{display:none!important}body{margin:0;background:#17191c;color:#fafafa;font:16px system-ui}header{padding:1rem;display:flex;align-items:center;gap:1.5rem;flex-wrap:wrap}label{display:flex;align-items:center;gap:.5rem}main{overflow:auto;height:calc(100dvh - 80px)}figure{margin:0 auto;position:relative;width:fit-content;max-width:100%}img{display:block;max-width:100%;height:auto}#original{position:absolute;inset:0;width:100%;height:100%;clip-path:inset(0 50% 0 0)}#line{position:absolute;top:0;bottom:0;left:50%;border-left:2px solid white;pointer-events:none}body.zoom figure{max-width:none}body.zoom img{max-width:none}body.zoom main{overflow:auto}input[type=range]{max-width:30vw}</style>" +
    '<header><strong>Before / After</strong><label>View <select id="mode"><option>Slider</option><option>Lens</option></select></label><label id="rangeLabel">Split <input id="range" type="range" min="0" max="100" value="50"></label><label><input id="zoom" type="checkbox">Actual pixels</label></header>' +
    '<main><figure id="stage"><img id="result" alt="Upscaled result" src="' +
    esc(after) +
    '"><img id="original" alt="Original" src="' +
    esc(before) +
    '"><span id="line"></span></figure></main>' +
    '<script>const $=id=>document.getElementById(id),stage=$("stage"),orig=$("original"),range=$("range"),mode=$("mode"),line=$("line");let x=50,y=50;function draw(){const lens=mode.value==="Lens";orig.style.clipPath=lens?"circle(80px at "+x+"% "+y+"%)":"inset(0 "+(100-range.value)+"% 0 0)";line.hidden=lens;line.style.left=range.value+"%";$("rangeLabel").hidden=lens}stage.onpointermove=e=>{const r=stage.getBoundingClientRect();x=Math.min(100,Math.max(0,100*(e.clientX-r.left)/r.width));y=100*(e.clientY-r.top)/r.height;if(mode.value==="Lens")draw();else if(e.buttons===1){range.value=x;draw()}};range.oninput=mode.onchange=draw;$("zoom").onchange=e=>document.body.classList.toggle("zoom",e.target.checked);draw()</script></html>'
  );
}
export async function compareLocal(input: string, output: string) {
  await Promise.all([inspect(input), inspect(output)]);
  const dir = await mkdtemp(join(tmpdir(), "upscayl-view-"));
  const page = join(dir, "comparison.html");
  await Bun.write(
    page,
    comparison(
      pathToFileURL(resolve(input)).href,
      pathToFileURL(resolve(output)).href,
    ),
  );
  const opener =
    process.platform === "darwin"
      ? ["open", page]
      : process.platform === "win32"
        ? ["rundll32", "url.dll,FileProtocolHandler", pathToFileURL(page).href]
        : ["xdg-open", page];
  const p = Bun.spawn(opener, { stdout: "ignore", stderr: "ignore" });
  p.unref();
  return page;
}
