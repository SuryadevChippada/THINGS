"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import s from "./webcam.module.css";

/** The sensor, such as it was. */
const CAM_W = 320;
const CAM_H = 240;

/**
 * 010 — 2004 WEBCAM
 *
 * A webcam that is bad on purpose, in the specific ways they used to be:
 * 320×240, blown highlights, white balance that has given up, a sensor
 * that adds more noise the darker it gets, over-sharpening that leaves
 * halos on every edge, and a timestamp burned into the corner in a font
 * nobody chose.
 *
 * The camera only starts when you ask it to, and every frame is processed
 * here.
 */
export default function Webcam2004() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const aliveRef = useRef(true);

  const [live, setLive] = useState(false);
  const [shot, setShot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      setError("no camera found, which is also very 2004");
    }
  }, []);

  // The live, ruined preview.
  //
  // Depends on `shot` as well as `live`: showing a capture swaps the
  // canvas out for an <img>, so coming back mounts a *new* canvas and the
  // loop has to re-attach to it or it draws into a detached one.
  useEffect(() => {
    if (!live || shot) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = CAM_W;
    canvas.height = CAM_H;
    let raf = 0;
    let lastDraw = 0;

    const frame = (now: number) => {
      // these things never managed a smooth frame rate
      if (now - lastDraw > 66) {
        lastDraw = now;
        if (video.videoWidth) {
          const scale = Math.max(CAM_W / video.videoWidth, CAM_H / video.videoHeight);
          const dw = video.videoWidth * scale;
          const dh = video.videoHeight * scale;
          ctx.save();
          ctx.translate(CAM_W, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, (CAM_W - dw) / 2, (CAM_H - dh) / 2, dw, dh);
          ctx.restore();
          cheapen(ctx, CAM_W, CAM_H);
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [live, shot]);

  const capture = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // saved as a low-quality JPEG, obviously
    setShot(canvas.toDataURL("image/jpeg", 0.42));
  }, []);

  return (
    <div className={s.stage}>
      <div className={s.panel}>
        <div className={s.bezel}>
          {shot ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={s.screen} src={shot} alt="webcam capture" />
          ) : (
            <canvas ref={canvasRef} className={s.screen} />
          )}
          {!live && !shot ? <div className={s.off}>no signal</div> : null}
        </div>

        <video ref={videoRef} muted playsInline className={s.hidden} />

        <div className={s.row}>
          {!live ? (
            <button className={s.button} onClick={enable}>
              Turn camera on
            </button>
          ) : shot ? (
            <>
              <a className={s.button} href={shot} download="webcam.jpg">
                Save
              </a>
              <button className={s.button} onClick={() => setShot(null)}>
                Back to live
              </button>
            </>
          ) : (
            <button className={s.button} onClick={capture}>
              Take picture
            </button>
          )}
        </div>

        {error ? <p className={s.note}>{error}</p> : null}
      </div>
    </div>
  );
}

/** Everything that was wrong with a webcam in 2004, applied deliberately. */
function cheapen(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const before = new Uint8ClampedArray(d);

  for (let i = 0; i < d.length; i += 4) {
    let r = before[i];
    let g = before[i + 1];
    let b = before[i + 2];

    // white balance permanently confused, leaning blue-green
    r *= 0.94;
    g *= 1.02;
    b *= 1.12;

    // and the exposure permanently too hot, so highlights just die
    r = r * 1.28;
    g = g * 1.28;
    b = b * 1.24;

    // noise that gets worse in the shadows, like a cheap sensor
    const lum = (r + g + b) / 3;
    const noise = (Math.random() - 0.5) * (34 - Math.min(28, lum / 9));
    d[i] = clamp(r + noise);
    d[i + 1] = clamp(g + noise);
    d[i + 2] = clamp(b + noise);
  }

  // over-sharpening: subtract a shifted copy, which leaves halos
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      const left = ((y * w + x - 1) * 4);
      for (let c = 0; c < 3; c++) {
        d[i + c] = clamp(d[i + c] + (d[i + c] - before[left + c]) * 0.45);
      }
    }
  }

  ctx.putImageData(img, 0, 0);

  // 4:2:0 chroma blocks, badly faked
  ctx.globalAlpha = 0.16;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(ctx.canvas, 0, 0, w, h, 0, 0, w / 8, h / 8);
  ctx.drawImage(ctx.canvas, 0, 0, w / 8, h / 8, 0, 0, w, h);
  ctx.globalAlpha = 1;

  // the timestamp, burned in
  const now = new Date();
  const stamp =
    [
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
      now.getFullYear(),
    ].join("/") +
    "  " +
    [
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"),
      String(now.getSeconds()).padStart(2, "0"),
    ].join(":");

  ctx.font = "bold 13px 'Courier New', monospace";
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillText(stamp, w - 7, h - 8);
  ctx.fillStyle = "#f7f4d0";
  ctx.fillText(stamp, w - 8, h - 9);
}

function clamp(v: number) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}
