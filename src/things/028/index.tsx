"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import s from "./sand.module.css";

/** 0 is air. Everything else is a material index into COLOURS. */
const COLOURS = [
  "",
  "#d8b26a", // sand
  "#c9875c", // copper
  "#a8523f", // rust
  "#e8e2d6", // salt
  "#6d94a8", // water-blue
  "#8aa35c", // moss
  "#a87ca0", // orchid
  "#5c5a56", // stone — this one does not fall
];
const STONE = 8;
const CELL = 4;

type Dir = "down" | "up" | "left" | "right";
const VECTORS: Record<Dir, [number, number]> = {
  down: [0, 1],
  up: [0, -1],
  left: [-1, 0],
  right: [1, 0],
};

/**
 * 028 — SAND
 *
 * Pour sand, and it behaves: it falls, piles into slopes, and finds its
 * way around whatever is in the way.
 *
 * Each grain only knows three rules — go with gravity if you can, else
 * try one diagonal, else stay — and everything that looks like physics
 * comes out of running that over a grid. Stone is the exception: it just
 * sits there, which makes it useful for building things to bury.
 *
 * Turning gravity sideways destroys whatever you made, which is the other
 * half of the toy.
 */
export default function Sand() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridRef = useRef<Uint8Array>(new Uint8Array(0));
  const sizeRef = useRef({ w: 0, h: 0 });
  const brushRef = useRef({ down: false, x: 0, y: 0, material: 1, size: 4 });
  const dirRef = useRef<Dir>("down");

  const [material, setMaterial] = useState(1);
  const [size, setSize] = useState(4);
  const [dir, setDir] = useState<Dir>("down");

  useEffect(() => {
    brushRef.current.material = material;
  }, [material]);
  useEffect(() => {
    brushRef.current.size = size;
  }, [size]);
  useEffect(() => {
    dirRef.current = dir;
  }, [dir]);

  const clear = useCallback(() => {
    gridRef.current.fill(0);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // the simulation runs at grid resolution and is scaled up on draw
    const off = document.createElement("canvas");
    const octx = off.getContext("2d");
    if (!octx) return;

    let w = 0;
    let h = 0;

    const resize = () => {
      w = Math.floor(window.innerWidth / CELL);
      h = Math.floor(window.innerHeight / CELL);
      sizeRef.current = { w, h };
      const next = new Uint8Array(w * h);
      // keep what is already there when the window changes
      const prev = gridRef.current;
      if (prev.length) {
        const pw = Math.min(w, Math.floor(window.innerWidth / CELL));
        for (let y = 0; y < h && y * pw < prev.length; y++) {
          for (let x = 0; x < pw; x++) {
            const from = y * pw + x;
            if (from < prev.length) next[y * w + x] = prev[from];
          }
        }
      }
      gridRef.current = next;
      off.width = w;
      off.height = h;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.imageSmoothingEnabled = false;
    };
    resize();
    window.addEventListener("resize", resize);

    /** Drop one brushful at a point, in grid coordinates. */
    const stamp = (px: number, py: number) => {
      const b = brushRef.current;
      const grid = gridRef.current;
      const gx = Math.floor(px / CELL);
      const gy = Math.floor(py / CELL);
      for (let dy = -b.size; dy <= b.size; dy++) {
        for (let dx = -b.size; dx <= b.size; dx++) {
          if (dx * dx + dy * dy > b.size * b.size) continue;
          const x = gx + dx;
          const y = gy + dy;
          if (x < 0 || x >= w || y < 0 || y >= h) continue;
          // a sparse brush pours rather than paints a solid disc
          if (b.material !== STONE && Math.random() > 0.34) continue;
          grid[y * w + x] = b.material;
        }
      }
    };

    /**
     * Pour along the whole stroke, not just where the pointer ended up.
     *
     * Pointer events arrive far faster than frames do, so stamping only
     * once per frame leaves gaps in a quick drag — and none at all if the
     * tab is throttled. Interpolating between the last point and this one
     * keeps the line solid however slowly the page is running.
     */
    const stroke = (x: number, y: number) => {
      const b = brushRef.current;
      const dist = Math.hypot(x - b.x, y - b.y);
      const steps = Math.max(1, Math.ceil(dist / (b.size * CELL * 0.5)));
      for (let i = 1; i <= steps; i++) {
        stamp(b.x + (x - b.x) * (i / steps), b.y + (y - b.y) * (i / steps));
      }
      b.x = x;
      b.y = y;
    };

    // held still, it keeps pouring
    const pour = () => {
      if (!brushRef.current.down) return;
      stamp(brushRef.current.x, brushRef.current.y);
    };

    /** One pass of the automaton. */
    const settle = () => {
      const grid = gridRef.current;
      const [gx, gy] = VECTORS[dirRef.current];
      // perpendicular, for the two diagonal slides
      const px = -gy;
      const py = gx;

      // walk against gravity so a grain can't fall twice in one pass
      const xs = gx > 0;
      const ys = gy > 0;
      for (let iy = 0; iy < h; iy++) {
        const y = ys ? h - 1 - iy : iy;
        for (let ix = 0; ix < w; ix++) {
          const x = xs ? w - 1 - ix : ix;
          const i = y * w + x;
          const cell = grid[i];
          if (cell === 0 || cell === STONE) continue;

          const move = (tx: number, ty: number) => {
            if (tx < 0 || tx >= w || ty < 0 || ty >= h) return false;
            const j = ty * w + tx;
            if (grid[j] !== 0) return false;
            grid[j] = cell;
            grid[i] = 0;
            return true;
          };

          if (move(x + gx, y + gy)) continue;
          // then a diagonal, picked at random so piles stay symmetric
          const first = Math.random() < 0.5 ? 1 : -1;
          if (move(x + gx + px * first, y + gy + py * first)) continue;
          move(x + gx - px * first, y + gy - py * first);
        }
      }
    };

    const draw = () => {
      const grid = gridRef.current;
      const img = octx.createImageData(w, h);
      const d = img.data;
      for (let i = 0; i < grid.length; i++) {
        const v = grid[i];
        if (!v) continue;
        const hex = COLOURS[v];
        d[i * 4] = parseInt(hex.slice(1, 3), 16);
        d[i * 4 + 1] = parseInt(hex.slice(3, 5), 16);
        d[i * 4 + 2] = parseInt(hex.slice(5, 7), 16);
        d[i * 4 + 3] = 255;
      }
      octx.putImageData(img, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
    };

    let raf = 0;
    const frame = () => {
      pour();
      settle();
      draw();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onDown = (e: PointerEvent) => {
      brushRef.current.down = true;
      brushRef.current.x = e.clientX;
      brushRef.current.y = e.clientY;
      canvas.setPointerCapture(e.pointerId);
      stamp(e.clientX, e.clientY);
    };
    const onMove = (e: PointerEvent) => {
      if (brushRef.current.down) stroke(e.clientX, e.clientY);
      else {
        brushRef.current.x = e.clientX;
        brushRef.current.y = e.clientY;
      }
    };
    const onUp = () => {
      brushRef.current.down = false;
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return (
    <div className={s.stage}>
      <canvas ref={canvasRef} className={s.canvas} />

      <div className={s.controls}>
        <div className={s.swatches}>
          {COLOURS.map((hex, i) =>
            i === 0 ? null : (
              <button
                key={i}
                className={`${s.swatch} ${material === i ? s.swatchOn : ""}`}
                style={{ background: hex }}
                onClick={() => setMaterial(i)}
                aria-label={i === STONE ? "stone" : `colour ${i}`}
                title={i === STONE ? "stone — does not fall" : undefined}
              />
            ),
          )}
        </div>

        <label className={s.slider}>
          brush
          <input
            type="range"
            min={1}
            max={12}
            step={1}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
          />
        </label>

        <div className={s.row}>
          {(Object.keys(VECTORS) as Dir[]).map((d) => (
            <button
              key={d}
              className={`${s.chip} ${dir === d ? s.chipOn : ""}`}
              onClick={() => setDir(d)}
            >
              {d === "down" ? "↓" : d === "up" ? "↑" : d === "left" ? "←" : "→"}
            </button>
          ))}
          <button className={s.chip} onClick={clear}>
            clear
          </button>
        </div>
      </div>
    </div>
  );
}
