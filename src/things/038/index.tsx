"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { things } from "@/things/registry";
import s from "./year.module.css";

const TAU = Math.PI * 2;
const EYE = 1.6;
const RADIUS = 26;

/**
 * 038 — ONE YEAR
 *
 * A year of this, laid out as a room you can walk through.
 *
 * Every thing in the archive gets a plinth, in order, arranged around a
 * circle — the further round you walk, the later it is. What sits on each
 * plinth is built from the entry itself: its shape comes from the
 * category, its colour from the id, and its height from how big a job it
 * was. Nothing is hand-placed, so the room grows on its own as the
 * archive does.
 */
export default function OneYear() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x0d0d0d);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0d0d0d, 0.026);
    const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 120);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(RADIUS + 14, 64),
      new THREE.MeshStandardMaterial({ color: 0x1c1c1f, roughness: 0.9 }),
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    scene.add(new THREE.AmbientLight(0x8b93a2, 0.5));

    const plinthGeo = new THREE.CylinderGeometry(0.42, 0.5, 1, 12);
    const plinthMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 1 });

    /** Everything on a plinth is generated from its registry entry. */
    const exhibits: { pos: THREE.Vector3; label: string }[] = [];

    things.forEach((thing, i) => {
      const angle = (i / things.length) * TAU;
      const x = Math.cos(angle) * RADIUS;
      const z = Math.sin(angle) * RADIUS;

      const plinth = new THREE.Mesh(plinthGeo, plinthMat);
      plinth.position.set(x, 0.5, z);
      scene.add(plinth);

      const hue = (parseInt(thing.id, 10) * 37) % 360;
      const colour = new THREE.Color().setHSL(hue / 360, 0.42, 0.55);
      const built = thing.status === "complete";
      const mat = new THREE.MeshStandardMaterial({
        color: colour,
        roughness: 0.55,
        emissive: colour,
        // unbuilt things are here, but they aren't lit
        emissiveIntensity: built ? 0.5 : 0.04,
        transparent: !built,
        opacity: built ? 1 : 0.32,
      });

      const scale = thing.scale === "large" ? 1.5 : thing.scale === "medium" ? 1.15 : 0.85;
      let geo: THREE.BufferGeometry;
      switch (thing.category) {
        case "camera":
        case "photography":
          geo = new THREE.BoxGeometry(0.5, 0.34, 0.3);
          break;
        case "3d":
        case "meta":
          geo = new THREE.IcosahedronGeometry(0.28, 0);
          break;
        case "audio":
          geo = new THREE.TorusGeometry(0.22, 0.07, 8, 20);
          break;
        case "physics":
          geo = new THREE.SphereGeometry(0.26, 16, 12);
          break;
        case "stupid":
          geo = new THREE.TetrahedronGeometry(0.32, 0);
          break;
        case "atmospheric":
          geo = new THREE.ConeGeometry(0.24, 0.5, 14);
          break;
        default:
          geo = new THREE.OctahedronGeometry(0.27, 0);
      }

      const piece = new THREE.Mesh(geo, mat);
      piece.scale.setScalar(scale);
      piece.position.set(x, 1.28, z);
      piece.userData.spin = 0.2 + (i % 5) * 0.06;
      scene.add(piece);

      if (built) {
        const glow = new THREE.PointLight(colour.getHex(), 3.2, 5, 2);
        glow.position.set(x, 1.5, z);
        scene.add(glow);
      }

      exhibits.push({
        pos: new THREE.Vector3(x, 1.3, z),
        label: `${thing.id} · ${thing.title}${built ? "" : " — not made yet"}`,
      });
    });

    // --- walking around ------------------------------------------
    let px = 0;
    let pz = 0;
    let yaw = 0;
    let pitch = 0;
    const keys = new Set<string>();

    const onKeyDown = (e: KeyboardEvent) => keys.add(e.code);
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== renderer.domElement) return;
      yaw -= e.movementX * 0.0022;
      pitch = Math.max(-1.1, Math.min(1.1, pitch - e.movementY * 0.0022));
    };
    const onClick = () => {
      if (document.pointerLockElement !== renderer.domElement) {
        void renderer.domElement.requestPointerLock();
      }
    };
    const onLockChange = () => setLocked(document.pointerLockElement === renderer.domElement);
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("resize", onResize);
    document.addEventListener("pointerlockchange", onLockChange);
    renderer.domElement.addEventListener("click", onClick);

    let raf = 0;
    let last = performance.now();
    let shown: string | null = null;

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const run = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 2.2 : 1;
      const speed = 4.2 * run * dt;
      let fwd = 0;
      let strafe = 0;
      if (keys.has("KeyW") || keys.has("ArrowUp")) fwd += 1;
      if (keys.has("KeyS") || keys.has("ArrowDown")) fwd -= 1;
      if (keys.has("KeyA") || keys.has("ArrowLeft")) strafe -= 1;
      if (keys.has("KeyD") || keys.has("ArrowRight")) strafe += 1;

      if (fwd || strafe) {
        const len = Math.hypot(fwd, strafe) || 1;
        px += ((-Math.sin(yaw) * fwd + Math.cos(yaw) * strafe) / len) * speed;
        pz += ((-Math.cos(yaw) * fwd - Math.sin(yaw) * strafe) / len) * speed;
        const out = Math.hypot(px, pz);
        if (out > RADIUS + 10) {
          px = (px / out) * (RADIUS + 10);
          pz = (pz / out) * (RADIUS + 10);
        }
      }

      camera.position.set(px, EYE, pz);
      camera.rotation.set(0, 0, 0);
      camera.rotateY(yaw);
      camera.rotateX(pitch);

      // name whatever you are standing in front of
      let closest: string | null = null;
      let bestDist = 3.4;
      for (const ex of exhibits) {
        const d = Math.hypot(ex.pos.x - px, ex.pos.z - pz);
        if (d < bestDist) {
          bestDist = d;
          closest = ex.label;
        }
      }
      if (closest !== shown) {
        shown = closest;
        setNear(closest);
      }

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.userData.spin) {
          obj.rotation.y += obj.userData.spin * dt;
          obj.position.y += Math.sin(now / 900 + obj.position.x) * 0.0004;
        }
      });

      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("pointerlockchange", onLockChange);
      renderer.domElement.removeEventListener("click", onClick);
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const m = obj.material;
          if (Array.isArray(m)) m.forEach((x) => x.dispose());
          else m.dispose();
        }
      });
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className={s.stage} ref={mountRef}>
      {near ? <span className={s.label}>{near}</span> : null}
      {!locked ? <span className={s.prompt}>click to look around</span> : null}
    </div>
  );
}
