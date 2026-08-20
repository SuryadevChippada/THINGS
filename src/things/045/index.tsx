"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import s from "./planet.module.css";

const R = 6;
const STORAGE = "things:045:planted";

interface Planted {
  /** Where on the sphere, and when it went in. */
  lat: number;
  lon: number;
  at: number;
}

/**
 * 045 — TINY PLANET
 *
 * A world small enough to walk all the way round in a minute.
 *
 * Plant a tree and it stays — not just for this visit, but properly: each
 * one records the moment it went in, and grows against the real clock. A
 * sapling you leave today is a full tree in a week. Come back in a month
 * and the place is a forest you don't remember making.
 */
export default function TinyPlanet() {
  const mountRef = useRef<HTMLDivElement>(null);
  const plantedRef = useRef<Planted[]>([]);
  const [count, setCount] = useState(0);

  const save = useCallback(() => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(plantedRef.current));
    } catch {
      // never worth a crash
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) plantedRef.current = parsed;
      } catch {
        // start fresh
      }
    }
    setCount(plantedRef.current.length);

    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x0d0d0d);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 200);

    scene.add(new THREE.AmbientLight(0x6c7d94, 0.75));
    const sun = new THREE.DirectionalLight(0xfff0d0, 1.5);
    sun.position.set(8, 12, 6);
    scene.add(sun);

    // a few stars, so it is somewhere rather than nowhere
    const starPos = new Float32Array(600 * 3);
    for (let i = 0; i < 600; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(70 + Math.random() * 40);
      starPos.set([v.x, v.y, v.z], i * 3);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xd6d1c9, size: 0.35 })));

    const world = new THREE.Group();
    scene.add(world);

    const globe = new THREE.Mesh(
      new THREE.IcosahedronGeometry(R, 3),
      new THREE.MeshStandardMaterial({ color: 0x4a6b48, roughness: 1, flatShading: true }),
    );
    world.add(globe);

    const water = new THREE.Mesh(
      new THREE.SphereGeometry(R * 0.985, 40, 28),
      new THREE.MeshStandardMaterial({ color: 0x2f5a70, roughness: 0.5, metalness: 0.1 }),
    );
    world.add(water);

    const trunkGeo = new THREE.CylinderGeometry(0.06, 0.09, 1, 5);
    const leafGeo = new THREE.ConeGeometry(0.42, 1, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x50372a, roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6b3f, roughness: 1, flatShading: true });

    const trees = new THREE.Group();
    world.add(trees);

    const positionOn = (lat: number, lon: number) =>
      new THREE.Vector3(
        R * Math.cos(lat) * Math.cos(lon),
        R * Math.sin(lat),
        R * Math.cos(lat) * Math.sin(lon),
      );

    /** A tree's size is how long it has actually been in the ground. */
    const growthOf = (at: number) => {
      const days = (Date.now() - at) / 86400000;
      return Math.min(1, 0.14 + Math.sqrt(Math.max(0, days)) * 0.42);
    };

    const build = () => {
      trees.clear();
      for (const p of plantedRef.current) {
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 0.5;
        tree.add(trunk);
        for (let i = 0; i < 3; i++) {
          const cone = new THREE.Mesh(leafGeo, leafMat);
          cone.scale.setScalar(1 - i * 0.2);
          cone.position.y = 1 + i * 0.42;
          tree.add(cone);
        }
        const pos = positionOn(p.lat, p.lon);
        tree.position.copy(pos);
        tree.lookAt(pos.clone().multiplyScalar(2));
        tree.rotateX(Math.PI / 2);
        tree.scale.setScalar(growthOf(p.at));
        trees.add(tree);
      }
    };
    build();

    // --- planting -------------------------------------------------
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let dragging = false;
    let moved = 0;
    const spin = { x: 0, y: 0 };
    const lastPointer = { x: 0, y: 0 };

    const onDown = (e: PointerEvent) => {
      dragging = true;
      moved = 0;
      lastPointer.x = e.clientX;
      lastPointer.y = e.clientY;
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastPointer.x;
      const dy = e.clientY - lastPointer.y;
      moved += Math.abs(dx) + Math.abs(dy);
      lastPointer.x = e.clientX;
      lastPointer.y = e.clientY;
      spin.y += dx * 0.005;
      spin.x += dy * 0.004;
    };
    const onUp = (e: PointerEvent) => {
      dragging = false;
      // a drag turns the world; a tap plants something
      if (moved > 6) return;

      pointer.set(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(globe, false)[0];
      if (!hit) return;

      const local = world.worldToLocal(hit.point.clone()).normalize();
      plantedRef.current.push({
        lat: Math.asin(local.y),
        lon: Math.atan2(local.z, local.x),
        at: Date.now(),
      });
      save();
      setCount(plantedRef.current.length);
      build();
    };

    renderer.domElement.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    let raf = 0;
    const frame = () => {
      spin.x *= 0.93;
      spin.y *= 0.93;
      world.rotation.y += spin.y + 0.0012;
      world.rotation.x = Math.max(-0.9, Math.min(0.9, world.rotation.x + spin.x));

      camera.position.set(0, 3.4, 15);
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("resize", onResize);
      save();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
          obj.geometry.dispose();
          const m = obj.material;
          if (Array.isArray(m)) m.forEach((x) => x.dispose());
          else m.dispose();
        }
      });
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [save]);

  return (
    <div className={s.stage}>
      <div ref={mountRef} className={s.scene} />
      <div className={s.hud}>
        <span>
          {count === 0
            ? "tap the ground to plant · drag to turn"
            : `${count} ${count === 1 ? "tree" : "trees"} · they grow while you're away`}
        </span>
        {count > 0 ? (
          <button
            className={s.button}
            onClick={() => {
              localStorage.removeItem(STORAGE);
              window.location.reload();
            }}
          >
            clear the world
          </button>
        ) : null}
      </div>
    </div>
  );
}
