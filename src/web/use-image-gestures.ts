import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

type Point = { x: number; y: number };
type View = Point & { zoom: number };
type Drag = {
  start: Point;
  view: View;
  split: number;
  kind: "pan" | "wipe" | "lens";
};
type Pinch = { center: Point; distance: number; view: View };
export type CompareMode = "result" | "slider" | "lens";

const fit: View = { zoom: 1, x: 0, y: 0 };
const middle = { x: 0.5, y: 0.5 };
const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));
const midpoint = (a: Point, b: Point) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function useImageGestures(
  width: number,
  height: number,
  pixelWidth: number,
  mode: CompareMode,
) {
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [position, renderPosition] = useState<View>(fit);
  // Pointer moves may be batched. A gesture handoff needs the latest position immediately.
  const latest = useRef<View>(fit);
  function setPosition(next: View) {
    latest.current = next;
    renderPosition(next);
  }
  const [split, setSplit] = useState(50);
  const [lens, setLens] = useState(middle);
  const pointers = useRef(new Map<number, Point>()).current;
  const drag = useRef<Drag | null>(null);
  const pinch = useRef<Pinch | null>(null);
  useLayoutEffect(() => {
    const el = canvas.current!;
    const measure = () =>
      setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fitScale = Math.min(size.width / width, size.height / height);
  const baseWidth = width * fitScale,
    baseHeight = height * fitScale;
  const actualZoom = baseWidth ? pixelWidth / baseWidth : 1;
  function bounded({ zoom, x, y }: View): View {
    const dx = Math.max(0, (baseWidth * zoom - size.width) / 2);
    const dy = Math.max(0, (baseHeight * zoom - size.height) / 2);
    return { zoom, x: clamp(x, -dx, dx), y: clamp(y, -dy, dy) };
  }
  const view = bounded(position);
  const pictureWidth = baseWidth * view.zoom,
    pictureHeight = baseHeight * view.zoom;
  const frameWidth = Math.min(pictureWidth, size.width),
    frameHeight = Math.min(pictureHeight, size.height);
  const canPan =
    pictureWidth > frameWidth + 0.5 || pictureHeight > frameHeight + 0.5;

  // Pointer and image offsets share the viewport center as their origin.
  function local(e: PointerEvent): Point {
    const r = canvas.current!.getBoundingClientRect();
    return {
      x: e.clientX - r.left - r.width / 2,
      y: e.clientY - r.top - r.height / 2,
    };
  }
  function moveLens(p: Point) {
    setLens({
      x: clamp(p.x / frameWidth + 0.5, 0, 1),
      y: clamp(p.y / frameHeight + 0.5, 0, 1),
    });
  }
  function start(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || pointers.size >= 2) return;
    const p = local(e);
    pointers.set(e.pointerId, p);
    e.currentTarget.setPointerCapture(e.pointerId);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch.current = {
        center: midpoint(a, b),
        distance: Math.max(1, distance(a, b)),
        view: bounded(latest.current),
      };
      drag.current = null;
      return;
    }
    const nearLine = Math.abs(p.x - (split / 100 - 0.5) * frameWidth) <= 24;
    const nearLens =
      Math.hypot(
        p.x - (lens.x - 0.5) * frameWidth,
        p.y - (lens.y - 0.5) * frameHeight,
      ) <= 68;
    let kind: Drag["kind"] = "pan";
    if (mode === "slider" && (nearLine || !canPan)) kind = "wipe";
    if (mode === "lens" && (!canPan || (nearLens && e.pointerType !== "mouse")))
      kind = "lens";
    // Keep a grab near the divider under the finger. Away from it, start the wipe at the touch.
    drag.current = {
      start: p,
      view: bounded(latest.current),
      kind,
      split: nearLine ? split : (p.x / frameWidth + 0.5) * 100,
    };
  }
  function moveDrag(d: Drag, p: Point) {
    const dx = p.x - d.start.x,
      dy = p.y - d.start.y;
    if (d.kind === "wipe")
      setSplit(clamp(d.split + (dx / frameWidth) * 100, 0, 100));
    if (d.kind === "lens") moveLens(p);
    if (d.kind === "pan")
      setPosition(
        bounded({ zoom: d.view.zoom, x: d.view.x + dx, y: d.view.y + dy }),
      );
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    const p = local(e);
    if (!pointers.has(e.pointerId)) {
      if (!pointers.size && e.pointerType === "mouse" && mode === "lens")
        moveLens(p);
      return;
    }
    pointers.set(e.pointerId, p);
    const initial = pinch.current;
    if (initial) {
      const [a, b] = [...pointers.values()];
      const center = midpoint(a, b);
      const zoom = clamp(
        (initial.view.zoom * distance(a, b)) / initial.distance,
        Math.min(1, initial.view.zoom),
        Math.max(8, actualZoom),
      );
      const factor = zoom / initial.view.zoom;
      setPosition(
        bounded({
          zoom,
          x: center.x - (initial.center.x - initial.view.x) * factor,
          y: center.y - (initial.center.y - initial.view.y) * factor,
        }),
      );
    } else if (drag.current) {
      moveDrag(drag.current, p);
    }
  }
  function end(e: PointerEvent<HTMLDivElement>) {
    if (!pointers.delete(e.pointerId)) return;
    if (e.type === "pointerup" && drag.current)
      moveDrag(drag.current, local(e));
    pinch.current = null;
    const [remaining] = pointers.values();
    drag.current = remaining
      ? { start: remaining, view: bounded(latest.current), split, kind: "pan" }
      : null;
  }

  function panBy(dx: number, dy: number) {
    const current = bounded(latest.current);
    const next = bounded({ ...current, x: current.x + dx, y: current.y + dy });
    if (next.x === current.x && next.y === current.y) return false;
    setPosition(next);
    return true;
  }
  useEffect(() => {
    const el = frame.current!;
    // Let the page scroll normally when the image has reached an edge.
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey || !e.cancelable) return;
      const unit =
        e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight : 1;
      if (panBy(-e.deltaX * unit, -e.deltaY * unit)) e.preventDefault();
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [baseWidth, baseHeight, size.width, size.height]);
  function keyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    const delta: Record<string, Point> = {
      ArrowUp: { x: 0, y: 40 },
      ArrowDown: { x: 0, y: -40 },
      ArrowLeft: { x: 40, y: 0 },
      ArrowRight: { x: -40, y: 0 },
    };
    const step = delta[e.key];
    if (step && panBy(step.x, step.y)) e.preventDefault();
  }
  const atFit = Math.abs(view.zoom - 1) < 0.0001;
  return {
    canvas,
    frame,
    view,
    frameWidth,
    frameHeight,
    pictureWidth,
    pictureHeight,
    canPan,
    split,
    setSplit,
    lens,
    atFit,
    toggleSize: () => setPosition(atFit ? { ...fit, zoom: actualZoom } : fit),
    handlers: {
      onKeyDown: keyDown,
      onPointerDown: start,
      onPointerMove: move,
      onPointerUp: end,
      onPointerCancel: end,
      onLostPointerCapture: end,
    },
  };
}
