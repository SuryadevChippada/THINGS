"use client";

import { useCallback, useRef, useState } from "react";
import s from "./shredder.module.css";

const MAX_W = 900;

interface Strip {
  /** Where this strip came from in the original. */
  src: number;
  w: number;
  offset: number;
  scale: number;
}

/**
 * 043 — IMAGE SHREDDER
 *
 * Feed it a photograph and it comes out in strips. Drag a strip to slide
 * it, drag up or down to stretch it, and shuffle the lot if you have lost
 * patience with the composition.
 *
 * Every strip still knows where it came from, so the picture can always
 * be put back — which makes wrecking it considerably more relaxing.
 */
export default function ImageShredder() {
  const fileRef = useRef<HTMLInputElement>(null);
  const sourceRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stripsRef = useRef<Strip[]>([]);
  const dragRef = useRef<{ index: number; x: number; y: number } | null>(null);

  const [ready, setReady] = useState(false);
  const [cuts, setCuts] = useState(18);

  const render = useCallback(() => {
    const src = sourceRef.current;
    const canvas = canvasRef.current;
    if (!src || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = src.width;
    canvas.height = src.height;
    ctx.fillStyle = "#0d0d0d";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let x = 0;
    for (const strip of stripsRef.current) {
      const h = canvas.height * strip.scale;
      ctx.drawImage(
        src,
        strip.src,
        0,
        strip.w,
        src.height,
        x,
        strip.offset + (canvas.height - h) / 2,
        strip.w,
        h,
      );
      x += strip.w;
    }
  }, []);

  const slice = useCallback(
    (count: number) => {
      const src = sourceRef.current;
      if (!src) return;
      const w = src.width / count;
      stripsRef.current = Array.from({ length: count }, (_, i) => ({
        src: i * w,
        w,
        offset: 0,
        scale: 1,
      }));
      render();
    },
    [render],
  );

  const load = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, MAX_W / img.width);
          const c = document.createElement("canvas");
          c.width = Math.round(img.width * scale);
          c.height = Math.round(img.height * scale);
          c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
          sourceRef.current = c;
          setReady(true);
          slice(cuts);
        };
        img.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    },
    [cuts, slice],
  );

  const stripAt = useCallback((clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return -1;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    let acc = 0;
    for (let i = 0; i < stripsRef.current.length; i++) {
      acc += stripsRef.current[i].w;
      if (x <= acc) return i;
    }
    return stripsRef.current.length - 1;
  }, []);

  const download = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "shredded.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, []);

  return (
    <div className={s.stage}>
      <div className={s.panel}>
        <div className={s.sheet}>
          {ready ? (
            <canvas
              ref={canvasRef}
              className={s.image}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                dragRef.current = { index: stripAt(e.clientX), x: e.clientX, y: e.clientY };
              }}
              onPointerMove={(e) => {
                const drag = dragRef.current;
                if (!drag) return;
                const strip = stripsRef.current[drag.index];
                if (!strip) return;
                const canvas = canvasRef.current;
                if (!canvas) return;
                const rect = canvas.getBoundingClientRect();
                const k = canvas.height / rect.height;
                // sideways slides it, up and down stretches it
                strip.offset += (e.clientY - drag.y) * k;
                strip.scale = Math.max(0.15, strip.scale + (e.clientX - drag.x) * 0.004);
                drag.x = e.clientX;
                drag.y = e.clientY;
                render();
              }}
              onPointerUp={() => {
                dragRef.current = null;
              }}
              onPointerCancel={() => {
                dragRef.current = null;
              }}
            />
          ) : (
            <p className={s.empty}>feed it a photograph</p>
          )}
        </div>

        <div className={s.controls}>
          <label className={s.slider}>
            cuts
            <input
              type="range"
              min={4}
              max={64}
              step={1}
              value={cuts}
              onChange={(e) => {
                const n = Number(e.target.value);
                setCuts(n);
                slice(n);
              }}
            />
          </label>

          <div className={s.row}>
            <button className={s.button} onClick={() => fileRef.current?.click()}>
              {ready ? "new photo" : "choose photo"}
            </button>
            {ready ? (
              <>
                <button
                  className={s.button}
                  onClick={() => {
                    // shuffle which slice sits where, keeping every piece
                    const strips = stripsRef.current;
                    for (let i = strips.length - 1; i > 0; i--) {
                      const j = Math.floor(Math.random() * (i + 1));
                      [strips[i].src, strips[j].src] = [strips[j].src, strips[i].src];
                    }
                    render();
                  }}
                >
                  shuffle
                </button>
                <button className={s.button} onClick={() => slice(cuts)}>
                  put it back
                </button>
                <button className={s.button} onClick={download}>
                  download
                </button>
              </>
            ) : null}
          </div>
          {ready ? <p className={s.hint}>drag a strip · sideways stretches, up and down slides</p> : null}
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
