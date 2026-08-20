"use client";

import { useCallback, useRef, useState } from "react";
import s from "./sorter.module.css";

const MAX_W = 900;
type By = "brightness" | "hue" | "saturation";
type Along = "column" | "row";

/**
 * 052 — PIXEL SORTER
 *
 * Brush over a photograph and the pixels under the brush sort themselves.
 *
 * Sorting a run of pixels destroys where things were but keeps exactly
 * what was there — every colour survives, just in order — so the result
 * is unmistakably still the photograph, smeared into bands. Brush lightly
 * for streaks; hold still and a region liquefies.
 */
export default function PixelSorter() {
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalRef = useRef<ImageData | null>(null);
  const paintingRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [by, setBy] = useState<By>("brightness");
  const [along, setAlong] = useState<Along>("column");
  const [radius, setRadius] = useState(60);

  const load = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, MAX_W / img.width);
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        originalRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setReady(true);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }, []);

  /** Sort the runs of pixels the brush is sitting on. */
  const smear = useCallback(
    (cx: number, cy: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d", { willReadFrequently: true });
      if (!canvas || !ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      const r = radius;
      const x0 = Math.max(0, Math.floor(cx - r));
      const x1 = Math.min(w, Math.ceil(cx + r));
      const y0 = Math.max(0, Math.floor(cy - r));
      const y1 = Math.min(h, Math.ceil(cy + r));
      if (x1 <= x0 || y1 <= y0) return;

      const img = ctx.getImageData(x0, y0, x1 - x0, y1 - y0);
      const d = img.data;
      const bw = x1 - x0;
      const bh = y1 - y0;

      const key = (i: number) => {
        const rr = d[i] / 255;
        const gg = d[i + 1] / 255;
        const bb = d[i + 2] / 255;
        if (by === "brightness") return 0.299 * rr + 0.587 * gg + 0.114 * bb;
        const max = Math.max(rr, gg, bb);
        const min = Math.min(rr, gg, bb);
        if (by === "saturation") return max === 0 ? 0 : (max - min) / max;
        // hue
        if (max === min) return 0;
        const delta = max - min;
        let hue: number;
        if (max === rr) hue = ((gg - bb) / delta) % 6;
        else if (max === gg) hue = (bb - rr) / delta + 2;
        else hue = (rr - gg) / delta + 4;
        return ((hue * 60 + 360) % 360) / 360;
      };

      const outer = along === "column" ? bw : bh;
      const inner = along === "column" ? bh : bw;

      for (let o = 0; o < outer; o++) {
        // only sort the part of the run inside the brush circle
        const run: { key: number; rgba: [number, number, number, number] }[] = [];
        const indices: number[] = [];
        for (let n = 0; n < inner; n++) {
          const bx = along === "column" ? o : n;
          const byy = along === "column" ? n : o;
          const gx = x0 + bx;
          const gy = y0 + byy;
          if (Math.hypot(gx - cx, gy - cy) > r) continue;
          const i = (byy * bw + bx) * 4;
          indices.push(i);
          run.push({ key: key(i), rgba: [d[i], d[i + 1], d[i + 2], d[i + 3]] });
        }
        if (run.length < 3) continue;
        run.sort((a, b) => a.key - b.key);
        indices.forEach((i, k) => {
          d[i] = run[k].rgba[0];
          d[i + 1] = run[k].rgba[1];
          d[i + 2] = run[k].rgba[2];
          d[i + 3] = run[k].rgba[3];
        });
      }

      ctx.putImageData(img, x0, y0);
    },
    [by, along, radius],
  );

  const at = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }, []);

  const restore = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const original = originalRef.current;
    if (!canvas || !ctx || !original) return;
    ctx.putImageData(original, 0, 0);
  }, []);

  const download = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "sorted.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, []);

  return (
    <div className={s.stage}>
      <div className={s.panel}>
        <div className={s.sheet}>
          <canvas
            ref={canvasRef}
            className={`${s.image} ${ready ? "" : s.hidden}`}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              paintingRef.current = true;
              const p = at(e);
              if (p) smear(p.x, p.y);
            }}
            onPointerMove={(e) => {
              if (!paintingRef.current) return;
              const p = at(e);
              if (p) smear(p.x, p.y);
            }}
            onPointerUp={() => {
              paintingRef.current = false;
            }}
            onPointerCancel={() => {
              paintingRef.current = false;
            }}
          />
          {!ready ? <p className={s.empty}>choose a photograph to ruin</p> : null}
        </div>

        <div className={s.controls}>
          <div className={s.row}>
            {(["brightness", "hue", "saturation"] as By[]).map((k) => (
              <button
                key={k}
                className={`${s.chip} ${by === k ? s.chipOn : ""}`}
                onClick={() => setBy(k)}
              >
                {k}
              </button>
            ))}
          </div>
          <div className={s.row}>
            {(["column", "row"] as Along[]).map((k) => (
              <button
                key={k}
                className={`${s.chip} ${along === k ? s.chipOn : ""}`}
                onClick={() => setAlong(k)}
              >
                {k === "column" ? "vertical" : "horizontal"}
              </button>
            ))}
            <label className={s.slider}>
              brush
              <input
                type="range"
                min={16}
                max={180}
                step={4}
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
              />
            </label>
          </div>
          <div className={s.row}>
            <button className={s.button} onClick={() => fileRef.current?.click()}>
              {ready ? "new photo" : "choose photo"}
            </button>
            {ready ? (
              <>
                <button className={s.button} onClick={restore}>
                  undo it all
                </button>
                <button className={s.button} onClick={download}>
                  download
                </button>
              </>
            ) : null}
          </div>
        </div>

        <input
          ref={fileRef}
          className={s.hidden}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) load(file);
          }}
        />
      </div>
    </div>
  );
}
