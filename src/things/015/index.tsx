"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import s from "./exposure.module.css";

const W = 720;
const H = 540;

/**
 * 015 — LONG EXPOSURE
 *
 * A shutter that stays open. Frames are accumulated onto one canvas
 * instead of replacing each other, so anything that moves draws a trail
 * and anything that stays still just gets sharper.
 *
 * Two ways to accumulate: keep the brightest value seen at each pixel,
 * which is how light painting works, or average everything, which is how
 * a real long exposure smears a crowd into fog. Wave a phone torch around
 * in a dark room for the good version.
 */
export default function LongExposure() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const plateRef = useRef<HTMLCanvasElement>(null);
  const scratchRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const aliveRef = useRef(true);
  const framesRef = useRef(0);

  const [live, setLive] = useState(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"lighten" | "average">("lighten");
  const [strength, setStrength] = useState(0.5);
  const [error, setError] = useState<string | null>(null);
  const [shot, setShot] = useState<string | null>(null);
  /** Mirrors framesRef a few times a second — the loop counts far too
      fast to drive a re-render on every frame. */
  const [frames, setFrames] = useState(0);

  const modeRef = useRef(mode);
  const openRef = useRef(open);
  const strengthRef = useRef(strength);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    openRef.current = open;
  }, [open]);
  useEffect(() => {
    strengthRef.current = strength;
  }, [strength]);

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

  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => setFrames(framesRef.current), 250);
    return () => window.clearInterval(timer);
  }, [open]);

  const clearPlate = useCallback(() => {
    const plate = plateRef.current;
    const ctx = plate?.getContext("2d");
    if (!plate || !ctx) return;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, plate.width, plate.height);
    framesRef.current = 0;
    setFrames(0);
  }, []);

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

  // Depends on `shot` too: keeping a photo swaps the plate for an <img>,
  // so starting a new one mounts a fresh canvas the loop must re-attach to.
  useEffect(() => {
    if (!live || shot) return;
    const plate = plateRef.current;
    const video = videoRef.current;
    if (!plate || !video) return;
    const ctx = plate.getContext("2d");
    if (!ctx) return;

    plate.width = W;
    plate.height = H;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    // one scratch canvas the incoming frame lands on before it is merged
    const scratch = scratchRef.current ?? document.createElement("canvas");
    scratch.width = W;
    scratch.height = H;
    scratchRef.current = scratch;
    const sctx = scratch.getContext("2d");
    if (!sctx) return;

    let raf = 0;
    const frame = () => {
      if (openRef.current && video.videoWidth) {
        const scale = Math.max(W / video.videoWidth, H / video.videoHeight);
        const dw = video.videoWidth * scale;
        const dh = video.videoHeight * scale;
        sctx.save();
        sctx.translate(W, 0);
        sctx.scale(-1, 1);
        sctx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
        sctx.restore();

        framesRef.current += 1;
        if (modeRef.current === "lighten") {
          // keep whatever was brightest — this is light painting
          ctx.globalCompositeOperation = "lighten";
          ctx.globalAlpha = 0.25 + strengthRef.current * 0.75;
        } else {
          // roll everything together, so movement turns to fog
          ctx.globalCompositeOperation = "source-over";
          ctx.globalAlpha = 0.02 + (1 - strengthRef.current) * 0.16;
        }
        ctx.drawImage(scratch, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [live, shot]);

  const capture = useCallback(() => {
    const plate = plateRef.current;
    if (!plate) return;
    setShot(plate.toDataURL("image/jpeg", 0.92));
  }, []);

  return (
    <div className={s.stage}>
      <div className={s.panel}>
        <div className={s.frame}>
          {shot ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={s.plate} src={shot} alt="long exposure" />
          ) : (
            <canvas ref={plateRef} className={s.plate} />
          )}
          {live && !shot ? (
            <span className={`${s.shutter} ${open ? s.shutterOpen : ""}`}>
              {open ? `open · ${frames} frames` : "shutter closed"}
            </span>
          ) : null}
        </div>

        <video ref={videoRef} muted playsInline className={s.hidden} />

        {!live ? (
          <>
            <button className={s.button} onClick={enable}>
              Enable camera
            </button>
            <p className={s.note}>
              hold the shutter open and move something bright through the frame.
              nothing leaves this machine.
            </p>
          </>
        ) : shot ? (
          <div className={s.row}>
            <a className={s.button} href={shot} download="long-exposure.jpg">
              Download
            </a>
            <button
              className={s.button}
              onClick={() => {
                setShot(null);
                framesRef.current = 0;
                setFrames(0);
              }}
            >
              New plate
            </button>
          </div>
        ) : (
          <>
            <div className={s.row}>
              <button className={s.button} onClick={() => setOpen((o) => !o)}>
                {open ? "Close shutter" : "Open shutter"}
              </button>
              <button className={s.button} onClick={clearPlate}>
                Clear
              </button>
              <button className={s.button} onClick={capture}>
                Keep it
              </button>
            </div>

            <div className={s.row}>
              <button
                className={`${s.chip} ${mode === "lighten" ? s.chipOn : ""}`}
                onClick={() => setMode("lighten")}
              >
                light painting
              </button>
              <button
                className={`${s.chip} ${mode === "average" ? s.chipOn : ""}`}
                onClick={() => setMode("average")}
              >
                slow film
              </button>
            </div>

            <label className={s.slider}>
              exposure
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={strength}
                onChange={(e) => setStrength(Number(e.target.value))}
              />
            </label>
          </>
        )}

        {error ? <p className={`${s.note} ${s.error}`}>{error}</p> : null}
      </div>
    </div>
  );
}
