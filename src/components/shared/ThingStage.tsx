"use client";

import { useEffect, useState, type ComponentType } from "react";

/**
 * Loads a thing's implementation on demand.
 *
 * Nothing heavy — Three.js, Matter, audio graphs — should ever reach the
 * archive bundle, so every experiment is its own chunk fetched at mount.
 */
export function ThingStage({ id }: { id: string }) {
  const [Thing, setThing] = useState<ComponentType | null>(null);

  useEffect(() => {
    let alive = true;
    import(`../../things/${id}/index`)
      .then((mod) => {
        if (alive) setThing(() => mod.default as ComponentType);
      })
      .catch((err) => {
        console.error(`thing ${id} failed to load`, err);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  return Thing ? <Thing /> : null;
}
