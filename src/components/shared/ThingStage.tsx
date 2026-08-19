"use client";

import { useEffect, useState, type ComponentType } from "react";
import { loaders } from "@/things/loaders";

/**
 * Loads a thing's implementation on demand.
 *
 * Nothing heavy — Three.js, Matter, audio graphs — should ever reach the
 * archive bundle, so every experiment is its own chunk fetched at mount.
 */
export function ThingStage({ id }: { id: string }) {
  const [Thing, setThing] = useState<ComponentType | null>(null);

  useEffect(() => {
    const load = loaders[id];
    if (!load) {
      console.error(`thing ${id} is marked complete but has no loader`);
      return;
    }
    let alive = true;
    load()
      .then((mod) => {
        if (alive) setThing(() => mod.default);
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
