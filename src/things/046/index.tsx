"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import s from "./ascii.module.css";

const SETS: Record<string, string> = {
  classic: " .:-=+*#%@",
  blocks: " ░▒▓█",
  dots: " ·∴∷▪▮█",
  letters: " .,:;i1tfLCG08@",
};

/**
 * 046 — ASCII CAMERA
 *
 * The camera, rendered entirely in characters.
 *
 * Each cell of the image is averaged down to one brightness, and that
 * picks a character from a ramp ordered by how much ink it puts on the
 * page. Nothing is drawn as an image — what you are looking at is text,
 * which is why you can pick it up and take it away as text.
 */
export default function AsciiCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const workRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const aliveRef = useRef(true);
  const settingsRef = useRef({ cols: 110, contrast: 1.15, invert: false, set: "classic" });

  const [live, setLive] = useState(false);
  const [art, setArt] = useState("");
  const [frozen, setFrozen] = useState<string | null>(null);
  const [cols, setCols] = useState(110);
  const [contrast, setContrast] = useState(1.15);
  const [invert, setInvert] = useState(false);
  const [set, setSet] = useState("classic");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    settingsRef.current = { cols, contrast, invert, set };
  }, [cols, contrast, invert, set]);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      stop();
    };
  }, [stop]);

  const enable = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false,
      });
      if (!aliveRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setLive(true);
    } catch {
      setError("no camera. permission denied, or nothing to see.");
    }
  }, []);

  useEffect(() => {
    if (!live || frozen) return;
    const video = videoRef.current;
    if (!video) return;
    const work = workRef.current ?? document.createElement("canvas");
    workRef.current = work;
    const ctx = work.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    let raf = 0;
    let lastAt = 0;
    const frame = (now: number) => {
      // characters do not need sixty frames a second
      if (now - lastAt > 66 && video.videoWidth) {
        lastAt = now;
        const { cols: c, contrast: k, invert: inv, set: setName } = settingsRef.current;
        const ramp = SETS[setName] ?? SETS.classic;
        // characters are about twice as tall as they are wide
        const rows = Math.max(8, Math.round((c * video.videoHeight) / video.videoWidth / 2.1));

        work.width = c;
        work.height = rows;
        ctx.save();
        ctx.translate(c, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, c, rows);
        ctx.restore();

        const d = ctx.getImageData(0, 0, c, rows).data;
        let out = "";
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < c; x++) {
            const i = (y * c + x) * 4;
            let lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
            lum = Math.min(1, Math.max(0, (lum - 0.5) * k + 0.5));
            if (inv) lum = 1 - lum;
            out += ramp[Math.min(ramp.length - 1, Math.floor(lum * ramp.length))];
          }
          out += "\n";
        }
        setArt(out);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [live, frozen]);

  const shown = frozen ?? art;

  const savePng = useCallback(() => {
    const lines = shown.split("\n").filter(Boolean);
    if (!lines.length) return;
    const cw = 8;
    const ch = 14;
    const c = document.createElement("canvas");
    c.width = lines[0].length * cw;
    c.height = lines.length * ch;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0d0d0d";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#d6d1c9";
    ctx.font = `${ch}px ui-monospace, monospace`;
    ctx.textBaseline = "top";
    lines.forEach((line, i) => ctx.fillText(line, 0, i * ch));
    const link = document.createElement("a");
    link.download = "ascii.png";
    link.href = c.toDataURL("image/png");
    link.click();
  }, [shown]);

  const saveText = useCallback(() => {
    const blob = new Blob([shown], { type: "text/plain" });
    const link = document.createElement("a");
    link.download = "ascii.txt";
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }, [shown]);

  return (
    <div className={s.stage}>
      <pre className={s.art} style={{ fontSize: `${Math.max(4, 760 / cols)}px` }}>
        {shown || (live ? "" : "no signal")}
      </pre>

      <video ref={videoRef} muted playsInline className={s.hidden} />

      <div className={s.controls}>
        {!live ? (
          <button className={s.button} onClick={enable}>
            Enable camera
          </button>
        ) : (
          <>
            <div className={s.row}>
              {Object.keys(SETS).map((name) => (
                <button
                  key={name}
                  className={`${s.chip} ${set === name ? s.chipOn : ""}`}
                  onClick={() => setSet(name)}
                >
                  {name}
                </button>
              ))}
              <button
                className={`${s.chip} ${invert ? s.chipOn : ""}`}
                onClick={() => setInvert((v) => !v)}
              >
                invert
              </button>
            </div>

            <div className={s.row}>
              <label className={s.slider}>
                width
                <input
                  type="range"
                  min={40}
                  max={190}
                  step={2}
                  value={cols}
                  onChange={(e) => setCols(Number(e.target.value))}
                />
              </label>
              <label className={s.slider}>
                contrast
                <input
                  type="range"
                  min={0.6}
                  max={2.4}
                  step={0.05}
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                />
              </label>
            </div>

            <div className={s.row}>
              <button className={s.button} onClick={() => setFrozen(frozen ? null : art)}>
                {frozen ? "back to live" : "hold"}
              </button>
              <button className={s.button} onClick={savePng}>
                png
              </button>
              <button className={s.button} onClick={saveText}>
                txt
              </button>
            </div>
          </>
        )}
        {error ? <p className={s.note}>{error}</p> : null}
      </div>
    </div>
  );
}
