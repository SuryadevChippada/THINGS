"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAudio, closeAudio } from "@/lib/audio";
import s from "./song.module.css";

/** Pentatonic, so any scribble is listenable. */
const SCALE = [0, 2, 4, 7, 9];
const OCTAVES = 4;
const ROOT = 130.81; // C3

interface Mark {
  /** Grid row, 0 at the top = highest pitch. */
  row: number;
  start: number;
  end: number;
  colour: number;
}

const ROWS = SCALE.length * OCTAVES;
const COLS = 64;

function pitch(row: number) {
  const fromBottom = ROWS - 1 - row;
  const octave = Math.floor(fromBottom / SCALE.length);
  const step = SCALE[fromBottom % SCALE.length];
  return ROOT * Math.pow(2, octave + step / 12);
}

/**
 * 039 — DRAW A SONG
 *
 * The canvas is the score. Height is pitch, width is time, and the length
 * of a line is how long the note is held.
 *
 * The grid is pentatonic across four octaves, so there is no wrong note —
 * which means the only thing you are really composing is rhythm and
 * shape, and a drawing that looks good tends to sound good.
 */
export default function DrawASong() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const marksRef = useRef<Mark[]>([]);
  const drawingRef = useRef<Mark | null>(null);
  const playRef = useRef({ on: false, head: 0 });
  const soundedRef = useRef(new Set<Mark>());

  const [playing, setPlaying] = useState(false);
  const [tempo, setTempo] = useState(4.5);
  const tempoRef = useRef(tempo);
  useEffect(() => {
    tempoRef.current = tempo;
  }, [tempo]);

  const sound = useCallback((mark: Mark) => {
    const ac = getAudio();
    if (!ac) return;
    const now = ac.currentTime;
    const length = Math.max(0.12, ((mark.end - mark.start) / tempoRef.current) * 0.9);

    const osc = ac.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = pitch(mark.row);

    const gain = ac.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.02);
    gain.gain.setTargetAtTime(0, now + length * 0.7, 0.12);

    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2600;

    osc.connect(filter).connect(gain).connect(ac.destination);
    osc.start(now);
    osc.stop(now + length + 0.4);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const play = playRef.current;
      if (play.on) {
        play.head += dt * tempoRef.current;
        if (play.head >= COLS) {
          play.head = 0;
          soundedRef.current.clear();
        }
        // fire any note the playhead has just crossed
        for (const mark of marksRef.current) {
          if (soundedRef.current.has(mark)) continue;
          if (play.head >= mark.start) {
            soundedRef.current.add(mark);
            sound(mark);
          }
        }
      }

      const cw = w / COLS;
      const rh = h / ROWS;

      ctx.clearRect(0, 0, w, h);

      // the staves — every fifth line is an octave
      for (let r = 0; r <= ROWS; r++) {
        ctx.strokeStyle =
          r % SCALE.length === 0 ? "rgba(214,209,201,0.13)" : "rgba(214,209,201,0.05)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, r * rh);
        ctx.lineTo(w, r * rh);
        ctx.stroke();
      }
      for (let c = 0; c <= COLS; c += 8) {
        ctx.strokeStyle = "rgba(214,209,201,0.07)";
        ctx.beginPath();
        ctx.moveTo(c * cw, 0);
        ctx.lineTo(c * cw, h);
        ctx.stroke();
      }

      const all = drawingRef.current
        ? [...marksRef.current, drawingRef.current]
        : marksRef.current;

      for (const mark of all) {
        const x = mark.start * cw;
        const y = mark.row * rh;
        const width = Math.max(cw * 0.6, (mark.end - mark.start) * cw);
        const lit = play.on && play.head >= mark.start && play.head <= mark.end + 0.6;
        ctx.fillStyle = lit
          ? "rgba(233, 196, 160, 0.95)"
          : `hsl(${(mark.colour * 47) % 360} 40% 62% / 0.8)`;
        ctx.beginPath();
        ctx.roundRect(x + 1, y + rh * 0.18, width - 2, rh * 0.64, rh * 0.32);
        ctx.fill();
      }

      if (play.on) {
        ctx.strokeStyle = "rgba(201,135,92,0.8)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(play.head * cw, 0);
        ctx.lineTo(play.head * cw, h);
        ctx.stroke();
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const cell = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        col: ((e.clientX - rect.left) / rect.width) * COLS,
        row: Math.floor(((e.clientY - rect.top) / rect.height) * ROWS),
      };
    };

    const onDown = (e: PointerEvent) => {
      const { col, row } = cell(e);
      drawingRef.current = {
        row: Math.max(0, Math.min(ROWS - 1, row)),
        start: Math.max(0, col),
        end: Math.max(0, col),
        colour: row,
      };
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const d = drawingRef.current;
      if (!d) return;
      d.end = Math.max(d.start, Math.min(COLS, cell(e).col));
    };
    const onUp = () => {
      const d = drawingRef.current;
      if (d) {
        d.end = Math.max(d.end, d.start + 0.7);
        marksRef.current.push(d);
        sound(d);
      }
      drawingRef.current = null;
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      closeAudio();
    };
  }, [sound]);

  return (
    <div className={s.stage}>
      <canvas ref={canvasRef} className={s.score} />

      <div className={s.controls}>
        <button
          className={s.button}
          onClick={() => {
            const next = !playRef.current.on;
            playRef.current.on = next;
            playRef.current.head = 0;
            soundedRef.current.clear();
            setPlaying(next);
          }}
        >
          {playing ? "stop" : "play"}
        </button>

        <label className={s.slider}>
          tempo
          <input
            type="range"
            min={1.5}
            max={12}
            step={0.5}
            value={tempo}
            onChange={(e) => setTempo(Number(e.target.value))}
          />
        </label>

        <button
          className={s.button}
          onClick={() => {
            marksRef.current = [];
            soundedRef.current.clear();
          }}
        >
          clear
        </button>
      </div>
    </div>
  );
}
