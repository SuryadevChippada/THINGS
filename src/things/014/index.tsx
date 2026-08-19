"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { click, closeAudio, getAudio } from "@/lib/audio";
import { LEVELS, proximity, type Node } from "./levels";
import s from "./maze.module.css";

const TAU = Math.PI * 2;
type Phase = "waiting" | "running" | "failed" | "won";

/**
 * 014 — DON'T TOUCH THE WALLS
 *
 * Your cursor is the player. Get from one end of the corridor to the
 * other without touching the sides.
 *
 * The corridor is a path with a width, not a row of boxes, so it can bend
 * and taper and squeeze. The walls know how close you are: they brighten
 * as you approach and the hum climbs with them, which is most of the
 * game — the corridor tells you you're about to lose slightly before you
 * do, and there is nothing you can do with that information except be
 * steadier.
 */
export default function DontTouchTheWalls() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef<Phase>("waiting");
  const levelRef = useRef(0);
  const startedAtRef = useRef(0);

  const [level, setLevel] = useState(0);
  const [phase, setPhase] = useState<Phase>("waiting");
  const [elapsed, setElapsed] = useState(0);
  const [best, setBest] = useState<Record<number, number>>({});

  const setBoth = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  useEffect(() => {
    levelRef.current = level;
  }, [level]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let unit = 0;
    /** The corridor is expensive to draw, so it is painted once. */
    let floor: HTMLCanvasElement | null = null;

    const nodes = (): Node[] => LEVELS[levelRef.current].nodes;

    const paintFloor = () => {
      const layer = document.createElement("canvas");
      layer.width = width;
      layer.height = height;
      const g = layer.getContext("2d");
      if (!g) return;

      const list = nodes();

      /**
       * Stamp circles along the path into their own opaque canvas.
       *
       * They have to be composited as one layer rather than drawn at low
       * alpha: consecutive stamps overlap heavily, so a 14% glow drawn
       * stamp-by-stamp accumulates into a solid copper tube.
       */
      const layerOf = (radius: (half: number) => number, fill: string) => {
        const c = document.createElement("canvas");
        c.width = width;
        c.height = height;
        const cg = c.getContext("2d");
        if (!cg) return c;
        cg.fillStyle = fill;
        for (let i = 0; i < list.length - 1; i++) {
          const a = list[i];
          const b = list[i + 1];
          const ax = a.x * width;
          const ay = a.y * height;
          const bx = b.x * width;
          const by = b.y * height;
          const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 3);
          for (let k = 0; k <= steps; k++) {
            const t = k / steps;
            const half = ((a.w + (b.w - a.w) * t) * unit) / 2;
            const r = radius(half);
            if (r <= 0) continue;
            cg.beginPath();
            cg.arc(ax + (bx - ax) * t, ay + (by - ay) * t, r, 0, TAU);
            cg.fill();
          }
        }
        return c;
      };

      const halo = layerOf((half) => half + 14, "#c9875c");
      const rim = layerOf((half) => half + 3, "#c9875c");
      const floorLayer = layerOf((half) => half, "#141416");
      const inner = layerOf((half) => half - 2, "#1c1c21");

      g.globalAlpha = 0.05;
      g.drawImage(halo, 0, 0);
      g.globalAlpha = 0.2;
      g.drawImage(rim, 0, 0);
      g.globalAlpha = 1;
      g.drawImage(floorLayer, 0, 0);
      g.drawImage(inner, 0, 0);

      floor = layer;
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      unit = Math.min(width, height);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintFloor();
    };
    resize();
    window.addEventListener("resize", resize);

    const cursor = { x: -999, y: -999 };
    const trail: { x: number; y: number }[] = [];

    // A hum that climbs as the walls close in.
    let hum: { osc: OscillatorNode; gain: GainNode } | null = null;
    const stopHum = () => {
      if (!hum) return;
      try {
        hum.osc.stop();
      } catch {
        // already stopped
      }
      hum = null;
    };
    const startHum = () => {
      if (hum) return;
      const ac = getAudio();
      if (!ac) return;
      const osc = ac.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = 90;
      const gain = ac.createGain();
      gain.gain.value = 0;
      osc.connect(gain).connect(ac.destination);
      osc.start();
      hum = { osc, gain };
    };

    const onMove = (e: PointerEvent) => {
      cursor.x = e.clientX;
      cursor.y = e.clientY;
      const list = nodes();
      const { ratio } = proximity(cursor.x, cursor.y, list, width, height, unit);
      const phaseNow = phaseRef.current;
      if (phaseNow === "failed" || phaseNow === "won") return;

      const startNode = list[0];
      const endNode = list[list.length - 1];
      const atStart =
        Math.hypot(cursor.x - startNode.x * width, cursor.y - startNode.y * height) <
        (startNode.w * unit) / 2;
      const atEnd =
        Math.hypot(cursor.x - endNode.x * width, cursor.y - endNode.y * height) <
        (endNode.w * unit) / 2;

      if (phaseNow === "waiting") {
        if (atStart) {
          startedAtRef.current = performance.now();
          startHum();
          setBoth("running");
        }
        return;
      }

      if (atEnd) {
        stopHum();
        click({ freq: 1200, gain: 0.2, decay: 0.16, q: 4 });
        const time = (performance.now() - startedAtRef.current) / 1000;
        setElapsed(time);
        setBest((prev) => {
          const lv = levelRef.current;
          return prev[lv] === undefined || time < prev[lv] ? { ...prev, [lv]: time } : prev;
        });
        setBoth("won");
        return;
      }

      if (ratio > 1) {
        stopHum();
        click({ freq: 120, gain: 0.4, decay: 0.3, q: 0.5 });
        setBoth("failed");
      }
    };
    window.addEventListener("pointermove", onMove);

    let raf = 0;
    const frame = (now: number) => {
      ctx.clearRect(0, 0, width, height);
      if (floor) ctx.drawImage(floor, 0, 0);

      const list = nodes();
      const phaseNow = phaseRef.current;
      const { ratio } = proximity(cursor.x, cursor.y, list, width, height, unit);
      const danger = Math.max(0, Math.min(1, (ratio - 0.45) / 0.55));

      if (phaseNow === "running") {
        // the corridor lights up when you crowd it
        if (hum) {
          hum.gain.gain.value = danger * 0.05;
          hum.osc.frequency.value = 90 + danger * 190;
        }
        if (danger > 0.05 && floor) {
          ctx.save();
          ctx.globalAlpha = danger * 0.5;
          ctx.globalCompositeOperation = "lighter";
          ctx.drawImage(floor, 0, 0);
          ctx.restore();
        }
        setElapsed((performance.now() - startedAtRef.current) / 1000);
      }

      // the ends
      const draw = (node: Node, colour: string, pulse: boolean) => {
        const x = node.x * width;
        const y = node.y * height;
        const r = (node.w * unit) / 2;
        ctx.strokeStyle = colour;
        ctx.lineWidth = 1.4;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.arc(x, y, r * 0.72 + (pulse ? Math.sin(now / 420) * 3 : 0), 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
      };
      draw(list[0], "rgba(153, 148, 141, 0.4)", false);
      draw(list[list.length - 1], "rgba(201, 135, 92, 0.85)", true);

      // you
      if (cursor.x > -100 && phaseNow !== "failed") {
        trail.push({ x: cursor.x, y: cursor.y });
        if (trail.length > 16) trail.shift();
        for (let i = 0; i < trail.length; i++) {
          const p = trail[i];
          const k = i / trail.length;
          ctx.fillStyle = `rgba(201, 135, 92, ${0.16 * k})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1 + k * 3.5, 0, TAU);
          ctx.fill();
        }

        const glow = ctx.createRadialGradient(cursor.x, cursor.y, 0, cursor.x, cursor.y, 26);
        glow.addColorStop(0, `rgba(233, 196, 160, ${0.5 + danger * 0.4})`);
        glow.addColorStop(1, "rgba(201, 135, 92, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cursor.x, cursor.y, 26, 0, TAU);
        ctx.fill();

        ctx.fillStyle = danger > 0.7 ? "#f0d3b4" : "#d6d1c9";
        ctx.beginPath();
        ctx.arc(cursor.x, cursor.y, 3.4, 0, TAU);
        ctx.fill();
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      stopHum();
      closeAudio();
    };
  }, [setBoth, level]);

  const spec = LEVELS[level];
  const last = level >= LEVELS.length - 1;

  return (
    <div className={`${s.stage} ${phase === "failed" ? s.shake : ""}`}>
      <canvas ref={canvasRef} className={s.canvas} />

      <div className={s.hud}>
        <span>
          {String(level + 1).padStart(2, "0")} · {spec.name}
        </span>
        <span className={s.timer}>
          {phase === "waiting" ? "—" : `${elapsed.toFixed(1)}s`}
          {best[level] !== undefined ? ` · best ${best[level].toFixed(1)}s` : ""}
        </span>
      </div>

      {phase === "waiting" ? (
        <span className={s.tip}>put the cursor on the ring to begin</span>
      ) : null}

      {phase === "failed" || phase === "won" ? (
        <div className={s.overlay}>
          <p className={s.verdict}>
            {phase === "failed"
              ? "you touched the wall"
              : last
                ? "that was all of them"
                : `clear · ${elapsed.toFixed(1)}s`}
          </p>
          <div className={s.row}>
            {phase === "failed" ? (
              <button className={s.button} onClick={() => setBoth("waiting")}>
                Again
              </button>
            ) : (
              <button
                className={s.button}
                onClick={() => {
                  setLevel(last ? 0 : level + 1);
                  setBoth("waiting");
                }}
              >
                {last ? "Start over" : "Next"}
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
