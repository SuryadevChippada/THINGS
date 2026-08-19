"use client";

import { useCallback, useRef, useState } from "react";
import s from "./copier.module.css";

const MAX_W = 900;

/**
 * 007 — BAD PHOTOCOPIER
 *
 * Feed it a photograph and press COPY. Then copy the copy, and the copy
 * of the copy. Each pass is applied to the previous output rather than
 * the original, so the damage compounds the way it does on a real machine
 * left in a corridor: contrast eats the midtones, the paper drifts a
 * little further off square, and the dirt on the glass never goes away.
 */
export default function BadPhotocopier() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);
  const [scanning, setScanning] = useState(false);

  const load = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // normalise to a sane working size before anything else
        const scale = Math.min(1, MAX_W / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setImage(canvas.toDataURL("image/jpeg", 0.92));
        setGeneration(0);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }, []);

  const copy = useCallback(() => {
    if (!image || scanning) return;
    setScanning(true);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      degrade(ctx, img);
      // JPEG at falling quality does some of the damage for us
      setImage(canvas.toDataURL("image/jpeg", Math.max(0.28, 0.88 - generation * 0.06)));
      setGeneration((g) => g + 1);
      window.setTimeout(() => setScanning(false), 860);
    };
    img.src = image;
  }, [image, generation, scanning]);

  const reset = useCallback(() => {
    setImage(null);
    setGeneration(0);
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  return (
    <div className={s.stage}>
      <div className={s.panel}>
        <div className={s.plate}>
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={s.image} src={image} alt={`copy, generation ${generation}`} />
          ) : (
            <p className={s.empty}>
              place a photograph on the glass
              <br />
              and close the lid
            </p>
          )}
          {scanning ? <div className={s.scan} /> : null}
        </div>

        <p className={s.meta}>
          {image ? (generation === 0 ? "original" : `generation ${generation}`) : "no original"}
        </p>

        <div className={s.row}>
          <button className={s.button} onClick={() => fileRef.current?.click()}>
            {image ? "New original" : "Choose photograph"}
          </button>
          <button className={s.button} onClick={copy} disabled={!image || scanning}>
            {generation === 0 ? "Copy" : "Copy again"}
          </button>
          {generation > 0 ? (
            <a className={s.button} href={image ?? "#"} download={`copy-${generation}.jpg`}>
              Download
            </a>
          ) : null}
          {image ? (
            <button className={s.button} onClick={reset}>
              Clear
            </button>
          ) : null}
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

/** One trip through the machine. */
function degrade(ctx: CanvasRenderingContext2D, img: HTMLImageElement) {
  const { width: w, height: h } = ctx.canvas;

  // the paper never goes through straight
  ctx.fillStyle = "#f2efe7";
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate((Math.random() - 0.5) * 0.008);
  ctx.translate((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5);
  ctx.scale(1.004, 1.004);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();

  const frame = ctx.getImageData(0, 0, w, h);
  const d = frame.data;

  for (let i = 0; i < d.length; i += 4) {
    // toner is grey, and it clips hard at both ends
    let v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    v = (v - 128) * 1.28 + 128;
    v += (Math.random() - 0.5) * 22;
    // slight warm cast from old paper
    d[i] = clamp(v * 1.02);
    d[i + 1] = clamp(v);
    d[i + 2] = clamp(v * 0.95);
  }
  ctx.putImageData(frame, 0, 0);

  // horizontal banding from a tired drum
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = "#000";
  for (let y = 0; y < h; y += 3 + Math.floor(Math.random() * 5)) {
    if (Math.random() < 0.22) ctx.fillRect(0, y, w, 1);
  }
  ctx.globalAlpha = 1;

  // a streak or two down the page
  for (let i = 0; i < 2; i++) {
    if (Math.random() > 0.55) continue;
    ctx.globalAlpha = 0.05 + Math.random() * 0.07;
    ctx.fillStyle = Math.random() > 0.5 ? "#000" : "#fff";
    ctx.fillRect(Math.random() * w, 0, 1 + Math.random() * 2, h);
  }
  ctx.globalAlpha = 1;

  // dirt on the glass, which is permanent
  ctx.fillStyle = "rgba(20,18,16,0.5)";
  for (let i = 0; i < 26; i++) {
    ctx.fillRect(Math.random() * w, Math.random() * h, Math.random() * 2 + 0.5, Math.random() * 2 + 0.5);
  }

  // and it never quite focuses again
  ctx.globalAlpha = 0.35;
  ctx.filter = "blur(0.7px)";
  ctx.drawImage(ctx.canvas, 0, 0);
  ctx.filter = "none";
  ctx.globalAlpha = 1;
}

function clamp(v: number) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}
