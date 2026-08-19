"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import s from "./receipt.module.css";

const W = 430; // paper width in device pixels — a roll, not a page
const PAD = 28;

interface Item {
  name: string;
  price: string;
}

/**
 * 013 — RECEIPT
 *
 * A thermal receipt printer that will print anything you tell it to.
 * Everything is drawn onto a canvas — the torn edges, the faded ink at
 * the top of the roll, the paper grain, the barcode nobody will scan — so
 * what you download is a real image rather than a screenshot of a webpage
 * pretending to be one.
 */
export default function Receipt() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [store, setStore] = useState("CORNER SHOP");
  const [footer, setFooter] = useState("THANK YOU");
  const [message, setMessage] = useState("no refunds, no regrets");
  const [items, setItems] = useState<Item[]>([
    { name: "MILK", price: "1.40" },
    { name: "BREAD", price: "2.10" },
    { name: "SOMETHING ELSE", price: "6.99" },
  ]);

  const setItem = useCallback((i: number, patch: Partial<Item>) => {
    setItems((prev) => prev.map((it, k) => (k === i ? { ...it, ...patch } : it)));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    draw(canvas, { store, footer, message, items });
  }, [store, footer, message, items]);

  const download = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "receipt.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, []);

  return (
    <div className={s.stage}>
      <div className={s.controls}>
        <label className={s.label}>
          Store
          <input className={s.input} value={store} onChange={(e) => setStore(e.target.value)} />
        </label>

        <div className={s.label}>
          Items
          <div className={s.items}>
            {items.map((item, i) => (
              <div className={s.item} key={i}>
                <input
                  className={s.input}
                  value={item.name}
                  onChange={(e) => setItem(i, { name: e.target.value })}
                />
                <input
                  className={s.input}
                  value={item.price}
                  inputMode="decimal"
                  onChange={(e) => setItem(i, { price: e.target.value })}
                />
                <button
                  className={s.mini}
                  aria-label="remove item"
                  onClick={() => setItems((prev) => prev.filter((_, k) => k !== i))}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        <button
          className={s.mini}
          onClick={() => setItems((prev) => [...prev, { name: "ITEM", price: "0.00" }])}
        >
          + add a line
        </button>

        <label className={s.label}>
          Message
          <input className={s.input} value={message} onChange={(e) => setMessage(e.target.value)} />
        </label>

        <label className={s.label}>
          Footer
          <input className={s.input} value={footer} onChange={(e) => setFooter(e.target.value)} />
        </label>

        <div className={s.row}>
          <button className={s.button} onClick={download}>
            Print it
          </button>
        </div>
      </div>

      <div className={s.paper}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}

interface Spec {
  store: string;
  footer: string;
  message: string;
  items: Item[];
}

function draw(canvas: HTMLCanvasElement, spec: Spec) {
  const lineH = 31;
  const height = 500 + spec.items.length * lineH;
  canvas.width = W;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // paper
  ctx.fillStyle = "#f3efe6";
  ctx.fillRect(0, 0, W, height);

  const mono = (size: number, weight = "400") =>
    `${weight} ${size}px "Courier New", ui-monospace, monospace`;
  const ink = "#2c2a27";

  ctx.fillStyle = ink;
  ctx.textAlign = "center";

  let y = 74;
  ctx.font = mono(26, "700");
  ctx.fillText(spec.store.toUpperCase().slice(0, 20), W / 2, y);

  y += 30;
  ctx.font = mono(14);
  const now = new Date();
  const date = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  ctx.fillText(`${date}   ${time}`, W / 2, y);

  y += 34;
  dashes(ctx, y, ink);

  // items
  y += 34;
  ctx.font = mono(16);
  let total = 0;
  for (const item of spec.items) {
    const value = parseFloat(item.price);
    if (Number.isFinite(value)) total += value;
    ctx.textAlign = "left";
    ctx.fillText(item.name.toUpperCase().slice(0, 20), PAD, y);
    ctx.textAlign = "right";
    ctx.fillText(Number.isFinite(value) ? value.toFixed(2) : item.price, W - PAD, y);
    y += lineH;
  }

  y += 6;
  dashes(ctx, y, ink);

  y += 36;
  ctx.font = mono(20, "700");
  ctx.textAlign = "left";
  ctx.fillText("TOTAL", PAD, y);
  ctx.textAlign = "right";
  ctx.fillText(total.toFixed(2), W - PAD, y);

  y += 30;
  ctx.font = mono(14);
  ctx.textAlign = "left";
  ctx.fillText("CASH", PAD, y);
  ctx.textAlign = "right";
  ctx.fillText(Math.ceil(total).toFixed(2), W - PAD, y);
  y += 24;
  ctx.textAlign = "left";
  ctx.fillText("CHANGE", PAD, y);
  ctx.textAlign = "right";
  ctx.fillText((Math.ceil(total) - total).toFixed(2), W - PAD, y);

  y += 40;
  ctx.textAlign = "center";
  ctx.font = mono(14);
  ctx.fillText(spec.message.slice(0, 30), W / 2, y);

  y += 40;
  ctx.font = mono(18, "700");
  ctx.fillText(spec.footer.toUpperCase().slice(0, 24), W / 2, y);

  // a barcode nobody will ever scan
  y += 34;
  let bx = PAD + 16;
  while (bx < W - PAD - 16) {
    const w = 1 + Math.floor(Math.random() * 4);
    ctx.fillStyle = ink;
    ctx.fillRect(bx, y, w, 46);
    bx += w + 1 + Math.floor(Math.random() * 4);
  }

  // torn edges, top and bottom
  tear(ctx, 0, W, true);
  tear(ctx, height, W, false);

  // thermal paper never prints evenly, and the roll fades at the top
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, "rgba(243,239,230,0.5)");
  grad.addColorStop(0.16, "rgba(243,239,230,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, height);

  const img = ctx.getImageData(0, 0, W, height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 12;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

function dashes(ctx: CanvasRenderingContext2D, y: number, ink: string) {
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 7]);
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Chew the paper edge the way a printer's cutter does. */
function tear(ctx: CanvasRenderingContext2D, edgeY: number, width: number, top: boolean) {
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.moveTo(0, edgeY);
  const dir = top ? 1 : -1;
  for (let x = 0; x <= width; x += 11) {
    ctx.lineTo(x, edgeY + dir * Math.random() * 9);
  }
  ctx.lineTo(width, edgeY - dir * 14);
  ctx.lineTo(0, edgeY - dir * 14);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
