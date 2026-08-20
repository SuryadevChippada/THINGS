"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import s from "./passport.module.css";

/** 35×45mm at 300dpi, which is the real size of the thing. */
const PW = 413;
const PH = 531;

type Phase = "idle" | "aligning" | "shooting" | "done";

/**
 * 036 — PASSPORT
 *
 * An automated photo booth that takes itself extremely seriously.
 *
 * It insists on the guides, counts you down whether you are ready or not,
 * takes four, and lays them out on a 6×4 print with a cutting line. It
 * has no idea what any government actually requires and neither do I —
 * this is a booth doing an impression of one, not a compliance tool.
 */
export default function Passport() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const shotsRef = useRef<HTMLCanvasElement[]>([]);
  const aliveRef = useRef(true);

  const [phase, setPhase] = useState<Phase>("idle");
  const [count, setCount] = useState(0);
  const [sheet, setSheet] = useState<string | null>(null);
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
      setPhase("aligning");
    } catch {
      setError("no camera. permission denied, or nothing to see.");
    }
  }, []);

  useEffect(() => {
    if (phase !== "aligning" && phase !== "shooting") return;
    const canvas = previewRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = PW;
    canvas.height = PH;

    let raf = 0;
    const frame = () => {
      if (video.videoWidth) {
        const scale = Math.max(PW / video.videoWidth, PH / video.videoHeight);
        const dw = video.videoWidth * scale;
        const dh = video.videoHeight * scale;
        ctx.save();
        ctx.translate(PW, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, (PW - dw) / 2, (PH - dh) / 2, dw, dh);
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const grab = useCallback(() => {
    const video = videoRef.current;
    if (!video) return null;
    const c = document.createElement("canvas");
    c.width = PW;
    c.height = PH;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    const scale = Math.max(PW / video.videoWidth, PH / video.videoHeight);
    ctx.save();
    ctx.translate(PW, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(
      video,
      (PW - video.videoWidth * scale) / 2,
      (PH - video.videoHeight * scale) / 2,
      video.videoWidth * scale,
      video.videoHeight * scale,
    );
    ctx.restore();

    // booths always overexpose slightly and always desaturate
    const img = ctx.getImageData(0, 0, PW, PH);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = clamp((d[i] * 0.75 + lum * 0.25) * 1.09 + 6);
      d[i + 1] = clamp((d[i + 1] * 0.75 + lum * 0.25) * 1.09 + 6);
      d[i + 2] = clamp((d[i + 2] * 0.75 + lum * 0.25) * 1.08 + 8);
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }, []);

  const run = useCallback(async () => {
    setPhase("shooting");
    shotsRef.current = [];
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

    for (let shot = 0; shot < 4; shot++) {
      for (let n = 3; n > 0; n--) {
        if (!aliveRef.current) return;
        setCount(n);
        await wait(700);
      }
      if (!aliveRef.current) return;
      setCount(0);
      const c = grab();
      if (c) shotsRef.current.push(c);
      await wait(600);
    }
    if (!aliveRef.current) return;

    // lay them out on a 6x4 print, with a line to cut along
    const out = document.createElement("canvas");
    out.width = 1800;
    out.height = 1200;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);

    const pad = 60;
    shotsRef.current.forEach((c, i) => {
      const x = pad + (i % 2) * (PW + pad);
      const y = pad + Math.floor(i / 2) * (PH + pad);
      ctx.drawImage(c, x, y);
      ctx.strokeStyle = "#c9c5bd";
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 3, y - 3, PW + 6, PH + 6);
      ctx.setLineDash([]);
    });

    ctx.fillStyle = "#6f6a62";
    ctx.font = "22px ui-monospace, monospace";
    ctx.fillText("35 × 45 mm · cut along the dashed line", pad, out.height - 42);
    ctx.font = "18px ui-monospace, monospace";
    ctx.fillText(
      "not checked against any official requirement",
      pad,
      out.height - 16,
    );

    setSheet(out.toDataURL("image/jpeg", 0.94));
    setPhase("done");
    stop();
  }, [grab, stop]);

  return (
    <div className={s.stage}>
      <div className={s.panel}>
        {phase === "done" && sheet ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={s.sheet} src={sheet} alt="passport sheet" />
            <div className={s.row}>
              <a className={s.button} href={sheet} download="passport.jpg">
                Download sheet
              </a>
              <button
                className={s.button}
                onClick={() => {
                  setSheet(null);
                  setPhase("idle");
                }}
              >
                Again
              </button>
            </div>
            <p className={s.note}>
              this booth has no idea what any government wants. check before you
              rely on it.
            </p>
          </>
        ) : (
          <>
            <div className={s.booth}>
              <canvas ref={previewRef} className={s.preview} />
              {/* the guides it insists on */}
              <div className={s.guides}>
                <span className={s.oval} />
                <span className={`${s.rule} ${s.ruleTop}`} />
                <span className={`${s.rule} ${s.ruleBottom}`} />
              </div>
              {count > 0 ? <div className={s.count}>{count}</div> : null}
              {phase === "idle" ? <div className={s.off}>booth closed</div> : null}
            </div>

            <video ref={videoRef} muted playsInline className={s.hidden} />

            {phase === "idle" ? (
              <button className={s.button} onClick={enable}>
                Open the booth
              </button>
            ) : phase === "aligning" ? (
              <>
                <button className={s.button} onClick={run}>
                  Begin
                </button>
                <p className={s.note}>
                  eyes between the lines. face inside the oval. do not smile.
                </p>
              </>
            ) : (
              <p className={s.note}>hold still</p>
            )}

            {error ? <p className={`${s.note} ${s.error}`}>{error}</p> : null}
          </>
        )}
      </div>
    </div>
  );
}

function clamp(v: number) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}
