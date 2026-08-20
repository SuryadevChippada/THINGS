"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import s from "./fisheye.module.css";

const W = 640;
const H = 480;

/**
 * 040 — FISHEYE
 *
 * A very wide lens on a very cheap camcorder.
 *
 * The distortion is done by hand: every output pixel is pulled from a
 * point closer to the centre of the source, by a factor that grows with
 * distance, which is what a fisheye physically does. Then it gets a
 * timestamp, a record dot, and the specific softness of tape.
 */
export default function Fisheye() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const aliveRef = useRef(true);
  const amountRef = useRef(0.62);

  const [live, setLive] = useState(false);
  const [amount, setAmount] = useState(0.62);
  const [shot, setShot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    amountRef.current = amount;
  }, [amount]);

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
        video: { width: { ideal: 1280 }, height: { ideal: 960 }, facingMode: "user" },
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
    if (!live || shot) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    canvas.width = W;
    canvas.height = H;

    // the undistorted frame lands here first
    const flat = document.createElement("canvas");
    flat.width = W;
    flat.height = H;
    const fctx = flat.getContext("2d", { willReadFrequently: true });
    if (!fctx) return;

    let raf = 0;
    const frame = () => {
      if (video.videoWidth) {
        const scale = Math.max(W / video.videoWidth, H / video.videoHeight);
        const dw = video.videoWidth * scale;
        const dh = video.videoHeight * scale;
        fctx.save();
        fctx.translate(W, 0);
        fctx.scale(-1, 1);
        fctx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
        fctx.restore();

        bulge(fctx, ctx, W, H, amountRef.current);
        camcorder(ctx, W, H);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [live, shot]);

  const capture = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) setShot(canvas.toDataURL("image/jpeg", 0.85));
  }, []);

  return (
    <div className={s.stage}>
      <div className={s.panel}>
        <div className={s.body}>
          {shot ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={s.screen} src={shot} alt="fisheye capture" />
          ) : (
            <canvas ref={canvasRef} className={s.screen} />
          )}
          {!live ? <div className={s.off}>stand by</div> : null}
        </div>

        <video ref={videoRef} muted playsInline className={s.hidden} />

        {!live ? (
          <>
            <button className={s.button} onClick={enable}>
              Record
            </button>
            <p className={s.note}>nothing leaves this machine.</p>
          </>
        ) : shot ? (
          <div className={s.row}>
            <a className={s.button} href={shot} download="fisheye.jpg">
              Save
            </a>
            <button className={s.button} onClick={() => setShot(null)}>
              Back to live
            </button>
          </div>
        ) : (
          <>
            <div className={s.row}>
              <button className={s.button} onClick={capture}>
                Capture
              </button>
            </div>
            <label className={s.slider}>
              lens
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </label>
          </>
        )}

        {error ? <p className={`${s.note} ${s.error}`}>{error}</p> : null}
      </div>
    </div>
  );
}

/**
 * Pull each output pixel from nearer the centre of the source.
 * The further out it is, the further in it reaches — which is the whole
 * of a fisheye, and cheap enough to run every frame.
 */
function bulge(
  from: CanvasRenderingContext2D,
  to: CanvasRenderingContext2D,
  w: number,
  h: number,
  amount: number,
) {
  const src = from.getImageData(0, 0, w, h);
  const dst = to.createImageData(w, h);
  const cx = w / 2;
  const cy = h / 2;
  const max = Math.hypot(cx, cy);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.hypot(dx, dy) / max;
      // r^k with k > 1 squeezes the middle outward and the edges in
      const k = 1 + amount * 1.4;
      const pull = r === 0 ? 0 : Math.pow(r, k) / r;

      const sx = Math.round(cx + dx * pull);
      const sy = Math.round(cy + dy * pull);
      const di = (y * w + x) * 4;
      if (sx < 0 || sx >= w || sy < 0 || sy >= h) {
        dst.data[di + 3] = 255;
        continue;
      }
      const si = (sy * w + sx) * 4;
      dst.data[di] = src.data[si];
      dst.data[di + 1] = src.data[si + 1];
      dst.data[di + 2] = src.data[si + 2];
      dst.data[di + 3] = 255;
    }
  }
  to.putImageData(dst, 0, 0);
}

/** The bits that make it a camcorder rather than a webcam. */
function camcorder(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const now = new Date();
  const date = `${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}.${now.getFullYear()}`;
  const time = [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");

  ctx.font = "bold 17px 'Courier New', monospace";
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillText(date, 19, h - 33);
  ctx.fillText(time, 19, h - 13);
  ctx.fillStyle = "#f2ecc8";
  ctx.fillText(date, 18, h - 34);
  ctx.fillText(time, 18, h - 14);

  // the record dot, blinking
  if (Math.floor(Date.now() / 700) % 2) {
    ctx.fillStyle = "#e04a3a";
    ctx.beginPath();
    ctx.arc(w - 44, 30, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = "bold 15px 'Courier New', monospace";
  ctx.fillStyle = "#f2ecc8";
  ctx.fillText("REC", w - 34, 36);

  // and the softness of tape
  ctx.globalAlpha = 0.2;
  ctx.filter = "blur(1.4px)";
  ctx.drawImage(ctx.canvas, 0, 0);
  ctx.filter = "none";
  ctx.globalAlpha = 1;
}
