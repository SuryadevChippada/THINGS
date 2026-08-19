"use client";

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
}

/**
 * The chronological indicator, sitting at the right edge where a scrollbar
 * would be: the marker tracks scroll continuously, the label follows the
 * thing you are actually looking at.
 */
export function Timeline({ progress, activeDate, newestDate, oldestDate }: Props) {
  const month = formatMonth(activeDate);

  return (
    <div className="timeline" aria-hidden="true">
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
