"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import s from "./pixels.module.css";

const N = 32;
const STORAGE = "things:032:canvas";

/** Sixteen colours. Constraints are the whole point of a 32×32. */
const PALETTE = [
  "transparent",
  "#12100e",
  "#3d3a35",
  "#6b665e",
  "#9c968b",
  "#d6d1c9",
  "#f4f1ea",
  "#8c4a3a",
  "#c9875c",
  "#e8b57a",
  "#5c6b3f",
  "#8aa35c",
  "#3f5a6b",
  "#6d94a8",
  "#6a4a6b",
  "#a87ca0",
];

type Tool = "pencil" | "eraser" | "fill" | "picker";

/**
 * 022 — 32×32
 *
 * A pixel studio that is exactly thirty-two by thirty-two, with sixteen
 * colours and four tools. You cannot zoom out, add a layer, or pick a
 * different colour, and that is the entire design — a small enough box
 * that you stop deciding and start drawing.
 *
 * Your work stays in this browser between visits, and exports at 16×.
 */
export default function ThirtyTwo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridRef = useRef<number[]>(new Array(N * N).fill(0));
  const undoRef = useRef<number[][]>([]);
  const paintingRef = useRef(false);

  const [colour, setColour] = useState(5);
  const [tool, setTool] = useState<Tool>("pencil");
  const [, forceDraw] = useState(0);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const cell = canvas.width / N;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const value = gridRef.current[y * N + x];
        if (value === 0) {
          // the transparent checker, so empty reads as empty
          ctx.fillStyle = (x + y) % 2 ? "#161618" : "#1c1c1f";
        } else {
          ctx.fillStyle = PALETTE[value];
        }
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === N * N) gridRef.current = parsed;
      } catch {
        // a corrupt save is not worth a crash
      }
    }
    paint();
  }, [paint]);

  const save = useCallback(() => {
    localStorage.setItem(STORAGE, JSON.stringify(gridRef.current));
  }, []);

  const pushUndo = useCallback(() => {
    undoRef.current.push([...gridRef.current]);
    if (undoRef.current.length > 40) undoRef.current.shift();
  }, []);

  /** Flood fill, iteratively — a recursive one blows the stack on a big area. */
  const flood = useCallback((start: number, next: number) => {
    const grid = gridRef.current;
    const target = grid[start];
    if (target === next) return;
    const queue = [start];
    while (queue.length) {
      const i = queue.pop()!;
      if (grid[i] !== target) continue;
      grid[i] = next;
      const x = i % N;
      const y = (i / N) | 0;
      if (x > 0) queue.push(i - 1);
      if (x < N - 1) queue.push(i + 1);
      if (y > 0) queue.push(i - N);
      if (y < N - 1) queue.push(i + N);
    }
  }, []);

  const apply = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor(((e.clientX - rect.left) / rect.width) * N);
      const y = Math.floor(((e.clientY - rect.top) / rect.height) * N);
      if (x < 0 || x >= N || y < 0 || y >= N) return;
      const i = y * N + x;

      if (tool === "picker") {
        setColour(gridRef.current[i]);
        return;
      }
      if (tool === "fill") {
        flood(i, colour);
      } else {
        gridRef.current[i] = tool === "eraser" ? 0 : colour;
      }
      paint();
      save();
    },
    [tool, colour, flood, paint, save],
  );

  const exportPng = useCallback(() => {
    const out = document.createElement("canvas");
    const scale = 16;
    out.width = N * scale;
    out.height = N * scale;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const value = gridRef.current[y * N + x];
        if (value === 0) continue; // stays transparent
        ctx.fillStyle = PALETTE[value];
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    const link = document.createElement("a");
    link.download = "32x32.png";
    link.href = out.toDataURL("image/png");
    link.click();
  }, []);

  return (
    <div className={s.stage}>
      <div className={s.panel}>
        <canvas
          ref={canvasRef}
          className={s.board}
          width={512}
          height={512}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            pushUndo();
            paintingRef.current = true;
            apply(e);
          }}
          onPointerMove={(e) => {
            if (paintingRef.current && tool !== "fill" && tool !== "picker") apply(e);
          }}
          onPointerUp={() => {
            paintingRef.current = false;
          }}
          onPointerCancel={() => {
            paintingRef.current = false;
          }}
        />

        <div className={s.swatches}>
          {PALETTE.map((hex, i) => (
            <button
              key={i}
              className={`${s.swatch} ${i === colour ? s.swatchOn : ""} ${i === 0 ? s.clear : ""}`}
              style={i === 0 ? undefined : { background: hex }}
              onClick={() => setColour(i)}
              aria-label={i === 0 ? "transparent" : hex}
            />
          ))}
        </div>

        <div className={s.tools}>
          {(["pencil", "eraser", "fill", "picker"] as Tool[]).map((id) => (
            <button
              key={id}
              className={`${s.tool} ${tool === id ? s.toolOn : ""}`}
              onClick={() => setTool(id)}
            >
              {id}
            </button>
          ))}

          <button
            className={s.tool}
            onClick={() => {
              const previous = undoRef.current.pop();
              if (!previous) return;
              gridRef.current = previous;
              paint();
              save();
              forceDraw((n) => n + 1);
            }}
          >
            undo
          </button>

          <button
            className={s.tool}
            onClick={() => {
              pushUndo();
              gridRef.current = new Array(N * N).fill(0);
              paint();
              save();
            }}
          >
            clear
          </button>

          <button className={`${s.tool} ${s.export}`} onClick={exportPng}>
            export
          </button>
        </div>
      </div>
    </div>
  );
}
