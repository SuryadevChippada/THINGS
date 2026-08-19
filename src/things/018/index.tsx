"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import s from "./riso.module.css";

const MAX_W = 900;

/** Riso inks are spot colours, not process — you pick two and live with it. */
const INKS = [
  { name: "fluoro pink / blue", a: [255, 72, 176], b: [0, 120, 191] },
  { name: "orange / teal", a: [255, 108, 47], b: [0, 131, 138] },
  { name: "red / black", a: [255, 63, 63], b: [30, 28, 28] },
  { name: "yellow / purple", a: [255, 185, 0], b: [118, 82, 165] },
  { name: "green / burgundy", a: [0, 169, 92], b: [145, 39, 63] },
];

/**
 * 018 — RISOGRAPH
 *
 * A duplicator, not a printer. The photograph is split into two spot inks,
 * each screened into its own grid of dots at its own angle, then printed
 * one after the other — and because the paper moves between passes, the
 * second colour never lands quite where the first one did.
 *
 * The misregistration is the point. Turn it off and it just looks broken.
 */
export default function Risograph() {
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceRef = useRef<HTMLCanvasElement | null>(null);

  const [ink, setInk] = useState(0);
  const [dot, setDot] = useState(4);
  const [drift, setDrift] = useState(3);
  const [ready, setReady] = useState(false);

  const render = useCallback(() => {
    const source = sourceRef.current;
    const canvas = canvasRef.current;
    if (!source || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = source.width;
    canvas.height = source.height;
    print(ctx, source, INKS[ink], dot, drift);
  }, [ink, dot, drift]);

  useEffect(() => {
    if (ready) render();
  }, [ready, render]);

  const load = useCallback((file: File) => {
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
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }, []);

  const download = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "risograph.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, []);

  return (
    <div className={s.stage}>
      <div className={s.panel}>
        <div className={s.sheet}>
          {ready ? (
            <canvas ref={canvasRef} className={s.print} />
          ) : (
            <p className={s.empty}>
              feed the duplicator
              <br />a photograph
            </p>
          )}
        </div>

        <div className={s.controls}>
          <div className={s.inks}>
            {INKS.map((choice, i) => (
              <button
                key={choice.name}
                className={`${s.swatch} ${i === ink ? s.swatchOn : ""}`}
                aria-label={choice.name}
                title={choice.name}
                onClick={() => setInk(i)}
              >
                <span style={{ background: `rgb(${choice.a.join(",")})` }} />
                <span style={{ background: `rgb(${choice.b.join(",")})` }} />
              </button>
            ))}
          </div>

          <label className={s.slider}>
            screen
            <input
              type="range"
              min={2}
              max={9}
              step={1}
              value={dot}
              onChange={(e) => setDot(Number(e.target.value))}
            />
          </label>

          <label className={s.slider}>
            misregistration
            <input
              type="range"
              min={0}
              max={10}
              step={0.5}
              value={drift}
              onChange={(e) => setDrift(Number(e.target.value))}
            />
          </label>

          <div className={s.row}>
            <button className={s.button} onClick={() => fileRef.current?.click()}>
              {ready ? "New photo" : "Choose photo"}
            </button>
            {ready ? (
              <>
                <button className={s.button} onClick={render}>
                  Print again
                </button>
                <button className={s.button} onClick={download}>
                  Download
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

type Ink = (typeof INKS)[number];

/** Two passes through the drum, one colour each. */
function print(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  ink: Ink,
  dot: number,
  drift: number,
) {
  const w = source.width;
  const h = source.height;

  const src = source.getContext("2d")?.getImageData(0, 0, w, h);
  if (!src) return;

  // paper first
  ctx.fillStyle = "#efe9dc";
  ctx.fillRect(0, 0, w, h);

  /**
   * One ink pass. `pick` pulls the channel this drum is carrying, the
   * screen is rotated so the two passes don't moiré against each other,
   * and the whole plate is nudged because the paper moved.
   */
  const pass = (
    colour: number[],
    pick: (r: number, g: number, b: number) => number,
    angle: number,
    offset: [number, number],
  ) => {
    ctx.save();
    ctx.translate(offset[0], offset[1]);
    ctx.fillStyle = `rgb(${colour.join(",")})`;
    ctx.globalAlpha = 0.92;

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const diag = Math.hypot(w, h);

    for (let v = -diag; v < diag; v += dot) {
      for (let u = -diag; u < diag; u += dot) {
        // sample in screen space, draw in rotated space
        const x = Math.round(u * cos - v * sin + w / 2);
        const y = Math.round(u * sin + v * cos + h / 2);
        if (x < 0 || x >= w || y < 0 || y >= h) continue;

        const i = (y * w + x) * 4;
        const density = pick(src.data[i], src.data[i + 1], src.data[i + 2]);
        if (density <= 0.02) continue;

        // dot size carries the tone, which is what a screen is
        const r = (dot / 2) * Math.sqrt(density) * 1.32;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  };

  const jitter = () => (Math.random() - 0.5) * 2 * drift;

  // shadows carry on the dark ink, midtones on the bright one
  pass(
    ink.b,
    (r, g, b) => 1 - (0.299 * r + 0.587 * g + 0.114 * b) / 255,
    0.35,
    [jitter(), jitter()],
  );
  pass(
    ink.a,
    (r, g, b) => {
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      // brightest where the image is mid-toned, so it isn't just a duplicate
      return Math.max(0, 1 - Math.abs(lum - 0.55) * 2.1);
    },
    1.2,
    [jitter(), jitter()],
  );

  // paper grain and the odd roller mark
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);

  ctx.globalAlpha = 0.05;
  ctx.fillStyle = "#000";
  for (let i = 0; i < 3; i++) {
    if (Math.random() > 0.5) ctx.fillRect(Math.random() * w, 0, 1, h);
  }
  ctx.globalAlpha = 1;
}
