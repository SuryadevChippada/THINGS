"use client";

import { useCallback, useRef, useState } from "react";
import s from "./contact.module.css";

const COLS = 5;
const FRAME_W = 320;
const FRAME_H = 214; // 3:2, like 35mm

/**
 * 054 — CONTACT SHEET
 *
 * The thing a lab hands back with the negatives: every frame on the roll,
 * in order, small, with the numbers down the side and the roll name across
 * the top.
 *
 * It is a way of looking at photographs that has almost disappeared —
 * all of them at once, none of them precious, the bad ones left in
 * because they were on the roll.
 */
export default function ContactSheet() {
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const framesRef = useRef<HTMLCanvasElement[]>([]);

  const [count, setCount] = useState(0);
  const [roll, setRoll] = useState("ROLL 01");
  const [note, setNote] = useState("");

  const paint = useCallback(
    (name: string, footnote: string) => {
      const frames = framesRef.current;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rows = Math.max(1, Math.ceil(frames.length / COLS));
      const pad = 34;
      const gap = 12;
      const head = 76;
      const foot = 54;

      canvas.width = COLS * FRAME_W + gap * (COLS - 1) + pad * 2;
      canvas.height = rows * (FRAME_H + 26) + gap * (rows - 1) + pad + head + foot;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // the sheet is a print, so it is paper, not black
      ctx.fillStyle = "#17171a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#d8d2c6";
      ctx.font = "600 30px ui-monospace, monospace";
      ctx.fillText(name.toUpperCase() || "ROLL", pad, 50);
      ctx.font = "16px ui-monospace, monospace";
      ctx.fillStyle = "#8b857a";
      ctx.fillText(
        `${frames.length} frames · ${new Date().toLocaleDateString()}`,
        pad,
        74,
      );

      frames.forEach((frame, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        const x = pad + col * (FRAME_W + gap);
        const y = head + pad + row * (FRAME_H + 26 + gap);

        ctx.drawImage(frame, x, y, FRAME_W, FRAME_H);
        // the frame edge, and the number under it
        ctx.strokeStyle = "rgba(216,210,198,0.22)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, FRAME_W - 1, FRAME_H - 1);
        ctx.fillStyle = "#c98a5c";
        ctx.font = "14px ui-monospace, monospace";
        ctx.fillText(`${String(i + 1).padStart(2, "0")}A`, x + 2, y + FRAME_H + 18);
      });

      if (footnote) {
        ctx.fillStyle = "#8b857a";
        ctx.font = "15px ui-monospace, monospace";
        ctx.fillText(footnote, pad, canvas.height - 22);
      }
    },
    [],
  );

  const add = useCallback(
    (files: FileList) => {
      let pending = files.length;
      Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            const c = document.createElement("canvas");
            c.width = FRAME_W;
            c.height = FRAME_H;
            const ctx = c.getContext("2d");
            if (ctx) {
              const scale = Math.max(FRAME_W / img.width, FRAME_H / img.height);
              const dw = img.width * scale;
              const dh = img.height * scale;
              ctx.drawImage(img, (FRAME_W - dw) / 2, (FRAME_H - dh) / 2, dw, dh);
              // a contact print is never as contrasty as the negative
              const data = ctx.getImageData(0, 0, FRAME_W, FRAME_H);
              const d = data.data;
              for (let i = 0; i < d.length; i += 4) {
                const n = (Math.random() - 0.5) * 12;
                d[i] = d[i] * 0.92 + 10 + n;
                d[i + 1] = d[i + 1] * 0.92 + 10 + n;
                d[i + 2] = d[i + 2] * 0.92 + 9 + n;
              }
              ctx.putImageData(data, 0, 0);
            }
            framesRef.current.push(c);
            pending--;
            if (pending === 0) {
              setCount(framesRef.current.length);
              paint(roll, note);
            }
          };
          img.src = String(reader.result);
        };
        reader.readAsDataURL(file);
      });
    },
    [paint, roll, note],
  );

  const download = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "contact-sheet.jpg";
    link.href = canvas.toDataURL("image/jpeg", 0.94);
    link.click();
  }, []);

  return (
    <div className={s.stage}>
      <div className={s.panel}>
        <div className={s.sheet}>
          <canvas ref={canvasRef} className={`${s.print} ${count ? "" : s.hidden}`} />
          {!count ? <p className={s.empty}>choose some photographs</p> : null}
        </div>

        <div className={s.controls}>
          <div className={s.row}>
            <input
              className={s.input}
              value={roll}
              maxLength={22}
              onChange={(e) => {
                setRoll(e.target.value);
                paint(e.target.value, note);
              }}
              placeholder="roll name"
            />
            <input
              className={s.input}
              value={note}
              maxLength={44}
              onChange={(e) => {
                setNote(e.target.value);
                paint(roll, e.target.value);
              }}
              placeholder="a note at the bottom"
            />
          </div>

          <div className={s.row}>
            <button className={s.button} onClick={() => fileRef.current?.click()}>
              add frames
            </button>
            {count ? (
              <>
                <button
                  className={s.button}
                  onClick={() => {
                    framesRef.current = [];
                    setCount(0);
                  }}
                >
                  empty the roll
                </button>
                <button className={s.button} onClick={download}>
                  print the sheet
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
          multiple
          onChange={(e) => {
            if (e.target.files?.length) add(e.target.files);
          }}
        />
      </div>
    </div>
  );
}
