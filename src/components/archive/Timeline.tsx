"use client";

import { useRef, useState } from "react";
import { formatMonth } from "@/lib/date";

interface Props {
  /** 0–1 scroll progress through the archive. */
  progress: number;
  /** ISO date of the thing nearest the viewport centre. */
  activeDate: string;
  /** ISO date of the newest thing (top of the list). */
  newestDate: string;
  /** ISO date of the oldest thing (bottom of the list). */
  oldestDate: string;
  /** Jump to a 0–1 position in the archive. */
  onScrub: (progress: number) => void;
}

/**
 * The chronological indicator — and the scrollbar. The native one is
 * hidden, so this has to do both jobs: report where you are in the
 * archive, and let you drag yourself somewhere else in it.
 */
export function Timeline({ progress, activeDate, newestDate, oldestDate, onScrub }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const month = formatMonth(activeDate);

  const positionFrom = (clientY: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    onScrub(Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)));
  };

  return (
    <div className={`timeline${scrubbing ? " timeline--scrubbing" : ""}`} ref={trackRef}>
      <div
        className="timeline__grab"
        role="scrollbar"
        aria-controls="archive-list"
        aria-label="archive position"
        aria-orientation="vertical"
        aria-valuenow={Math.round(progress * 100)}
        tabIndex={0}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setScrubbing(true);
          positionFrom(e.clientY);
        }}
        onPointerMove={(e) => {
          if (scrubbing) positionFrom(e.clientY);
        }}
        onPointerUp={() => setScrubbing(false)}
        onPointerCancel={() => setScrubbing(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") onScrub(Math.min(1, progress + 0.03));
          else if (e.key === "ArrowUp") onScrub(Math.max(0, progress - 0.03));
          else if (e.key === "Home") onScrub(0);
          else if (e.key === "End") onScrub(1);
          else return;
          e.preventDefault();
        }}
      />

      <div className="timeline__line" />

      <span className="timeline__cap timeline__cap--top">{formatMonth(newestDate)}</span>
      <span className="timeline__cap timeline__cap--bottom">{formatMonth(oldestDate)}</span>

      <div className="timeline__marker" style={{ top: `${progress * 100}%` }} />

      <span className="timeline__active" style={{ top: `${progress * 100}%` }} key={month}>
        {month}
      </span>

      <span className="timeline__arrow">↓</span>
    </div>
  );
}
