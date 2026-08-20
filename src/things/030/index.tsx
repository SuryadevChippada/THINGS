"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import s from "./globe.module.css";

const TAU = Math.PI * 2;
const FLAKES = 900;
const R = 1.5; // globe radius

/**
 * 030 — SNOW GLOBE
 *
 * Pick it up and shake it.
 *
 * The snow is nine hundred points in a sphere, each with its own drift
 * and fall rate. Shaking adds velocity; the rest is drag and gravity, so
 * it flurries when you're rough with it and takes a long, quiet while to
 * settle — which is the only part anyone actually wants.
 */
export default function SnowGlobe() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 40);
    camera.position.set(0, 0.35, 6.4);
    camera.lookAt(0, 0.1, 0);

    scene.add(new THREE.AmbientLight(0x8ea0b8, 1.2));
    const key = new THREE.DirectionalLight(0xfff0d8, 1.6);
    key.position.set(3, 5, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x7fa0c8, 0.8);
    rim.position.set(-4, 1, -3);
    scene.add(rim);

    const globe = new THREE.Group();
    scene.add(globe);

    // the base
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.35, 0.5, 40),
      new THREE.MeshStandardMaterial({ color: 0x53331f, roughness: 0.55 }),
    );
    base.position.y = -R - 0.16;
    globe.add(base);
    const trim = new THREE.Mesh(
      new THREE.TorusGeometry(1.14, 0.05, 10, 40),
      new THREE.MeshStandardMaterial({ color: 0xc9a469, roughness: 0.3, metalness: 0.8 }),
    );
    trim.rotation.x = Math.PI / 2;
    trim.position.y = -R + 0.08;
    globe.add(trim);

    // a little scene inside, so the snow has something to fall on
    const ground = new THREE.Mesh(
      new THREE.SphereGeometry(R * 0.99, 32, 16, 0, TAU, Math.PI * 0.62, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0xdfe6ee, roughness: 1 }),
    );
    globe.add(ground);

    const treeMat = new THREE.MeshStandardMaterial({ color: 0x2f4f3a, roughness: 1 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3428, roughness: 1 });
    for (const [tx, tz, scale] of [
      [0.3, 0.1, 1],
      [-0.45, -0.25, 0.72],
      [0.1, -0.55, 0.6],
    ] as [number, number, number][]) {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.22, 6), trunkMat);
      trunk.position.y = 0.11;
      tree.add(trunk);
      for (let i = 0; i < 3; i++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.24 - i * 0.05, 0.32, 7), treeMat);
        cone.position.y = 0.3 + i * 0.19;
        tree.add(cone);
      }
      tree.scale.setScalar(scale);
      tree.position.set(tx, -R * 0.52, tz);
      globe.add(tree);
    }

    const house = new THREE.Group();
    const walls = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.26, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xb8654a, roughness: 1 }),
    );
    walls.position.y = 0.13;
    house.add(walls);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(0.3, 0.2, 4),
      new THREE.MeshStandardMaterial({ color: 0xe8eef4, roughness: 1 }),
    );
    roof.position.y = 0.36;
    roof.rotation.y = Math.PI / 4;
    house.add(roof);
    const window0 = new THREE.Mesh(
      new THREE.PlaneGeometry(0.08, 0.08),
      new THREE.MeshBasicMaterial({ color: 0xffcf8a }),
    );
    window0.position.set(0, 0.15, 0.151);
    house.add(window0);
    house.position.set(-0.15, -R * 0.52, 0.35);
    globe.add(house);

    // --- the snow ------------------------------------------------
    const positions = new Float32Array(FLAKES * 3);
    const velocities = new Float32Array(FLAKES * 3);
    const fall = new Float32Array(FLAKES);

    const seed = (i: number) => {
      // random point inside the sphere
      const u = Math.random();
      const r = R * 0.94 * Math.cbrt(u);
      const theta = Math.random() * TAU;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      fall[i] = 0.16 + Math.random() * 0.3;
    };
    for (let i = 0; i < FLAKES; i++) seed(i);

    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const snow = new THREE.Points(
      snowGeo,
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.035,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    );
    globe.add(snow);

    // the glass goes on last, so it sits in front of everything
    const glass = new THREE.Mesh(
      new THREE.SphereGeometry(R, 48, 32),
      new THREE.MeshPhysicalMaterial({
        color: 0xcfe2f2,
        transparent: true,
        opacity: 0.16,
        roughness: 0.05,
        metalness: 0,
        transmission: 0.6,
        side: THREE.FrontSide,
      }),
    );
    globe.add(glass);

    // --- shaking --------------------------------------------------
    let shake = 0;
    let dragging = false;
    const lastPointer = { x: 0, y: 0 };
    const spin = { x: 0, y: 0 };

    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastPointer.x = e.clientX;
      lastPointer.y = e.clientY;
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastPointer.x;
      const dy = e.clientY - lastPointer.y;
      lastPointer.x = e.clientX;
      lastPointer.y = e.clientY;

      spin.y += dx * 0.004;
      spin.x += dy * 0.003;
      // how hard you are being with it decides how much it flurries
      shake = Math.min(1, shake + Math.hypot(dx, dy) * 0.012);

      for (let i = 0; i < FLAKES; i++) {
        velocities[i * 3] += (dx * 0.0006 + (Math.random() - 0.5) * 0.02) * shake;
        velocities[i * 3 + 1] += (Math.random() * 0.05 + 0.01) * shake;
        velocities[i * 3 + 2] += (Math.random() - 0.5) * 0.02 * shake;
      }
    };
    const onUp = () => {
      dragging = false;
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
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.033);
      last = now;

      shake = Math.max(0, shake - dt * 0.55);
      spin.x *= 0.94;
      spin.y *= 0.94;
      globe.rotation.y += spin.y + dt * 0.05;
      globe.rotation.x = Math.max(-0.35, Math.min(0.35, globe.rotation.x + spin.x));

      const floorAt = -R * 0.52;
      for (let i = 0; i < FLAKES; i++) {
        const p = i * 3;
        velocities[p] *= 0.94;
        velocities[p + 1] = velocities[p + 1] * 0.94 - fall[i] * dt;
        velocities[p + 2] *= 0.94;

        positions[p] += velocities[p];
        positions[p + 1] += velocities[p + 1];
        positions[p + 2] += velocities[p + 2];

        // settle on the ground, and stay inside the glass
        if (positions[p + 1] < floorAt) {
          positions[p + 1] = floorAt;
          velocities[p + 1] = 0;
          velocities[p] *= 0.6;
          velocities[p + 2] *= 0.6;
        }
        const d = Math.hypot(positions[p], positions[p + 1], positions[p + 2]);
        if (d > R * 0.95) {
          const k = (R * 0.95) / d;
          positions[p] *= k;
          positions[p + 1] *= k;
          positions[p + 2] *= k;
          velocities[p] *= -0.3;
          velocities[p + 2] *= -0.3;
        }
      }
      snowGeo.attributes.position.needsUpdate = true;

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
  }, []);

  return (
    <div className={s.stage}>
      <div ref={mountRef} className={s.scene} />
      <span className={s.hint}>pick it up</span>
    </div>
  );
}
