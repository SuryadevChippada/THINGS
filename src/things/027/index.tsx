"use client";

import { useCallback, useRef, useState } from "react";
import s from "./stars.module.css";

const TAU = Math.PI * 2;

interface Star {
  x: number;
  y: number;
  mag: number;
}

/**
 * 027 — CONSTELLATIONS
 *
 * Put stars in an empty sky, join them up, and give the shape a name.
 *
 * Nothing here decides anything for you — the sky is blank, the lines are
 * yours, and the meaning is entirely invented. Which is, as far as anyone
 * can tell, exactly how the real ones were made.
 */
export default function Constellations() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stars, setStars] = useState<Star[]>([]);
  const [links, setLinks] = useState<[number, number][]>([]);
  const [pending, setPending] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"place" | "join">("place");

  const near = useCallback(
    (x: number, y: number) => {
      for (let i = stars.length - 1; i >= 0; i--) {
        if (Math.hypot(stars[i].x - x, stars[i].y - y) < 22) return i;
      }
      return -1;
    },
    [stars],
  );

  const onClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const hit = near(x, y);

      if (mode === "join") {
        if (hit < 0) return;
        if (pending === null) {
          setPending(hit);
        } else if (pending !== hit) {
          setLinks((prev) =>
            prev.some(([a, b]) => (a === pending && b === hit) || (a === hit && b === pending))
              ? prev
              : [...prev, [pending, hit]],
          );
          setPending(null);
        } else {
          setPending(null);
        }
        return;
      }

      if (hit >= 0) return;
      setStars((prev) => [...prev, { x, y, mag: 0.5 + Math.random() * 0.9 }]);
    },
    [mode, near, pending],
  );

  /** Draw the finished card at print size and hand it over. */
  const download = useCallback(() => {
    const host = canvasRef.current?.parentElement;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const scale = 2;
    const out = document.createElement("canvas");
    out.width = rect.width * scale;
    out.height = rect.height * scale;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.scale(scale, scale);

    ctx.fillStyle = "#0a0b0f";
    ctx.fillRect(0, 0, rect.width, rect.height);

    // faint background stars, so the card isn't empty around the shape
    ctx.fillStyle = "rgba(214,209,201,0.24)";
    for (let i = 0; i < 260; i++) {
      const x = Math.random() * rect.width;
      const y = Math.random() * rect.height;
      ctx.globalAlpha = Math.random() * 0.5;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = "rgba(201,135,92,0.55)";
    ctx.lineWidth = 1;
    for (const [a, b] of links) {
      ctx.beginPath();
      ctx.moveTo(stars[a].x, stars[a].y);
      ctx.lineTo(stars[b].x, stars[b].y);
      ctx.stroke();
    }

    for (const star of stars) {
      const r = 1.6 + star.mag * 2.4;
      const glow = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, r * 4);
      glow.addColorStop(0, "rgba(240,238,232,0.9)");
      glow.addColorStop(1, "rgba(240,238,232,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(star.x, star.y, r * 4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#f4f1ea";
      ctx.beginPath();
      ctx.arc(star.x, star.y, r, 0, TAU);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(214,209,201,0.85)";
    ctx.font = "600 20px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText((name || "unnamed").toUpperCase(), rect.width / 2, rect.height - 46);
    ctx.font = "10px ui-monospace, monospace";
    ctx.fillStyle = "rgba(214,209,201,0.4)";
    ctx.fillText(
      `${stars.length} stars · ${links.length} lines · ${new Date().getFullYear()}`,
      rect.width / 2,
      rect.height - 26,
    );

    const link = document.createElement("a");
    link.download = `${(name || "constellation").replace(/\s+/g, "-").toLowerCase()}.png`;
    link.href = out.toDataURL("image/png");
    link.click();
  }, [stars, links, name]);

  return (
    <div className={s.stage}>
      <div className={s.sky} onClick={onClick}>
        <canvas ref={canvasRef} className={s.hidden} />

        <svg className={s.plot}>
          {links.map(([a, b], i) => (
            <line
              key={i}
              x1={stars[a].x}
              y1={stars[a].y}
              x2={stars[b].x}
              y2={stars[b].y}
              className={s.link}
            />
          ))}
          {stars.map((star, i) => (
            <g key={i}>
              <circle
                cx={star.x}
                cy={star.y}
                r={2 + star.mag * 2.6}
                className={`${s.star} ${pending === i ? s.starOn : ""}`}
              />
              {pending === i ? (
                <circle cx={star.x} cy={star.y} r={11} className={s.halo} />
              ) : null}
            </g>
          ))}
        </svg>

        {stars.length === 0 ? <p className={s.hint}>click the sky</p> : null}
        {name ? <p className={s.name}>{name}</p> : null}
      </div>

      <div className={s.controls}>
        <div className={s.row}>
          <button
            className={`${s.chip} ${mode === "place" ? s.chipOn : ""}`}
            onClick={() => {
              setMode("place");
              setPending(null);
            }}
          >
            place stars
          </button>
          <button
            className={`${s.chip} ${mode === "join" ? s.chipOn : ""}`}
            onClick={() => setMode("join")}
          >
            join them
          </button>
        </div>

        <input
          className={s.input}
          value={name}
          placeholder="name it"
          maxLength={28}
          onChange={(e) => setName(e.target.value)}
        />

        <div className={s.row}>
          <button
            className={s.chip}
            onClick={() => {
              setStars([]);
              setLinks([]);
              setPending(null);
            }}
          >
            clear sky
          </button>
          <button className={s.chip} onClick={download} disabled={stars.length === 0}>
            take the map
          </button>
        </div>
      </div>
    </div>
  );
}
