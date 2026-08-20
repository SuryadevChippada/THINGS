"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { click, closeAudio } from "@/lib/audio";
import s from "./typewriter.module.css";

const COLS = 62;
const ROWS = 26;

/**
 * 048 — TYPEWRITER
 *
 * A machine with one font, no undo, and a bell.
 *
 * The ink is uneven because a real ribbon is — each character is struck
 * with slightly different pressure and lands a fraction off the line, and
 * the ribbon wears as you go, so the bottom of a page is always fainter
 * than the top. You cannot go back and fix it. You can take the page.
 */
export default function Typewriter() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const linesRef = useRef<string[]>([""]);
  const [ribbon, setRibbon] = useState(1);
  /** How much has been struck. The page itself lives in a ref — this is
      only what the controls need to know. */
  const [struck, setStruck] = useState(0);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const cw = 15;
    const ch = 26;
    const pad = 54;
    canvas.width = COLS * cw + pad * 2;
    canvas.height = ROWS * ch + pad * 2;

    ctx.fillStyle = "#efe9dc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = "20px 'Courier New', ui-monospace, monospace";
    ctx.textBaseline = "top";

    const lines = linesRef.current;
    let struck = 0;
    lines.forEach((line, row) => {
      for (let col = 0; col < line.length; col++) {
        struck++;
        // the ribbon runs out as the page fills
        const wear = Math.max(0.32, 1 - struck / (COLS * ROWS) - Math.random() * 0.13);
        ctx.fillStyle = `rgba(28, 24, 20, ${wear})`;
        // and no key ever lands exactly on the line
        const jx = (Math.random() - 0.5) * 1.6;
        const jy = (Math.random() - 0.5) * 2.2;
        ctx.fillText(line[col], pad + col * cw + jx, pad + row * ch + jy);
      }
    });

    // paper grain
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 10;
      d[i] += n;
      d[i + 1] += n;
      d[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
  }, []);

  useEffect(() => {
    paint();
  }, [paint]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const lines = linesRef.current;
      const row = lines.length - 1;

      if (e.key === "Enter") {
        e.preventDefault();
        if (lines.length >= ROWS) return;
        // the carriage going back, which is the good noise
        click({ freq: 300, gain: 0.26, decay: 0.22, q: 0.8 });
        window.setTimeout(() => click({ freq: 900, gain: 0.18, decay: 0.1 }), 130);
        lines.push("");
      } else if (e.key === "Backspace") {
        // there is no backspace on a typewriter
        e.preventDefault();
        click({ freq: 180, gain: 0.1, decay: 0.05 });
        return;
      } else if (e.key.length === 1) {
        e.preventDefault();
        if (lines[row].length >= COLS) {
          if (lines.length >= ROWS) return;
          lines.push("");
        }
        lines[lines.length - 1] += e.key;
        click({ freq: 1400 + Math.random() * 900, gain: 0.2, decay: 0.035, q: 2.2 });
        // the bell, near the end of the line
        if (lines[lines.length - 1].length === COLS - 8) {
          window.setTimeout(() => click({ freq: 2600, gain: 0.2, decay: 0.5, q: 8 }), 40);
        }
      } else {
        return;
      }

      const used = linesRef.current.reduce((n, l) => n + l.length, 0);
      setRibbon(Math.max(0, 1 - used / (COLS * ROWS)));
      setStruck(used);
      paint();
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      closeAudio();
    };
  }, [paint]);

  const takePage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "page.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, []);

  const newPage = useCallback(() => {
    linesRef.current = [""];
    setRibbon(1);
    setStruck(0);
    paint();
  }, [paint]);

  const empty = struck === 0;

  return (
    <div className={s.stage}>
      <div className={s.machine}>
        <div className={s.roller} />
        <canvas ref={canvasRef} className={s.page} />
        <div className={s.rail}>
          <span className={s.ribbon}>
            ribbon
            <span className={s.gauge}>
              <span style={{ width: `${ribbon * 100}%` }} />
            </span>
          </span>
          <button className={s.button} onClick={takePage} disabled={empty}>
            take the page
          </button>
          <button className={s.button} onClick={newPage}>
            new sheet
          </button>
        </div>
      </div>
      {empty ? <p className={s.hint}>just start typing</p> : null}
    </div>
  );
}
