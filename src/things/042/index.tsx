"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { getAudio, closeAudio } from "@/lib/audio";
import s from "./walk.module.css";

const EYE = 1.62;
/** The street is a loop of this length, recycled ahead of you. */
const LOOP = 240;

/**
 * 042 — WALK HOME
 *
 * A quiet street, late. You walk. That is the entire thing.
 *
 * Nothing follows you, nothing is hiding, nothing will happen. The
 * footsteps are synthesised from your own pace, the windows go on and off
 * on their own schedule, and a car passes now and then several streets
 * away. It is not building toward anything, and it does not end.
 */
export default function WalkHome() {
  const mountRef = useRef<HTMLDivElement>(null);
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
    scene.fog = new THREE.Fog(0x0d0d0d, 18, 120);
    const camera = new THREE.PerspectiveCamera(66, window.innerWidth / window.innerHeight, 0.1, 160);

    scene.add(new THREE.AmbientLight(0x2c3646, 1.1));

    const pavement = new THREE.Mesh(
      new THREE.PlaneGeometry(9, LOOP * 2),
      new THREE.MeshStandardMaterial({ color: 0x2a2b2d, roughness: 0.85 }),
    );
    pavement.rotation.x = -Math.PI / 2;
    scene.add(pavement);

    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(14, LOOP * 2),
      new THREE.MeshStandardMaterial({ color: 0x1a1b1d, roughness: 0.5, metalness: 0.2 }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(-11, -0.04, 0);
    scene.add(road);

    /** Everything that gets moved back behind you once you pass it. */
    const movers: { obj: THREE.Object3D; gap: number }[] = [];
    const litWindows: THREE.Mesh[] = [];

    // lamps
    const postMat = new THREE.MeshStandardMaterial({ color: 0x26282b, roughness: 0.9 });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd7a0 });
    for (let i = 0; i < 10; i++) {
      const g = new THREE.Group();
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 6, 6), postMat);
      post.position.y = 3;
      g.add(post);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), bulbMat);
      head.position.set(-0.9, 5.7, 0);
      g.add(head);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1, 0.07, 0.07), postMat);
      arm.position.set(-0.45, 5.8, 0);
      g.add(arm);
      const light = new THREE.PointLight(0xffc98a, 40, 22, 2);
      light.position.set(-0.9, 5.5, 0);
      g.add(light);
      g.position.set(-3.6, 0, -i * 24);
      scene.add(g);
      movers.push({ obj: g, gap: 10 * 24 });
    }

    // houses, with windows that are sometimes on
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x232427, roughness: 1 });
    const winOn = new THREE.MeshBasicMaterial({ color: 0xe8bc78 });
    const winOff = new THREE.MeshBasicMaterial({ color: 0x14161a });
    for (let i = 0; i < 26; i++) {
      const g = new THREE.Group();
      const hgt = 5 + Math.random() * 4;
      const wid = 6 + Math.random() * 3;
      const body = new THREE.Mesh(new THREE.BoxGeometry(wid, hgt, 8), wallMat);
      body.position.y = hgt / 2;
      g.add(body);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(wid * 0.8, 1.8, 4), wallMat);
      roof.position.y = hgt + 0.9;
      roof.rotation.y = Math.PI / 4;
      g.add(roof);

      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
          const on = Math.random() < 0.34;
          const win = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.2), on ? winOn : winOff);
          win.position.set(-wid / 4 + col * (wid / 2), 1.6 + row * 2.2, -4.02);
          win.rotation.y = Math.PI;
          g.add(win);
          if (on) litWindows.push(win);
        }
      }

      g.position.set(6 + Math.random() * 2, 0, -i * 11 - Math.random() * 4);
      scene.add(g);
      movers.push({ obj: g, gap: 26 * 11 });
    }

    // --- sound ----------------------------------------------------
    const ac = getAudio();
    const step = (strength: number) => {
      if (!ac) return;
      const now = ac.currentTime;
      const frames = Math.ceil(ac.sampleRate * 0.09);
      const buffer = ac.createBuffer(1, frames, ac.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < frames; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 2.4;
      }
      const src = ac.createBufferSource();
      src.buffer = buffer;
      const filter = ac.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 900 + Math.random() * 500;
      filter.Q.value = 0.7;
      const gain = ac.createGain();
      gain.gain.value = 0.09 * strength;
      src.connect(filter).connect(gain).connect(ac.destination);
      src.start(now);
      src.stop(now + 0.1);
    };

    if (ac) {
      // the city, a long way off
      const frames = Math.ceil(ac.sampleRate * 3);
      const buffer = ac.createBuffer(1, frames, ac.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
      const src = ac.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const lp = ac.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 200;
      const gain = ac.createGain();
      gain.gain.value = 0.03;
      src.connect(lp).connect(gain).connect(ac.destination);
      src.start();
    }

    // --- walking --------------------------------------------------
    let z = 0;
    let yaw = 0;
    let pitch = 0;
    let bob = 0;
    const keys = new Set<string>();

    const onKeyDown = (e: KeyboardEvent) => keys.add(e.code);
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== renderer.domElement) return;
      yaw -= e.movementX * 0.002;
      pitch = Math.max(-0.9, Math.min(0.9, pitch - e.movementY * 0.002));
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
    let lastStep = 0;
    let x = 0;

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      let fwd = 0;
      let strafe = 0;
      if (keys.has("KeyW") || keys.has("ArrowUp")) fwd += 1;
      if (keys.has("KeyS") || keys.has("ArrowDown")) fwd -= 1;
      if (keys.has("KeyA") || keys.has("ArrowLeft")) strafe -= 1;
      if (keys.has("KeyD") || keys.has("ArrowRight")) strafe += 1;

      const moving = fwd !== 0 || strafe !== 0;
      const speed = 2.4 * dt;
      if (moving) {
        const len = Math.hypot(fwd, strafe) || 1;
        x += ((-Math.sin(yaw) * fwd + Math.cos(yaw) * strafe) / len) * speed;
        z += ((-Math.cos(yaw) * fwd - Math.sin(yaw) * strafe) / len) * speed;
        x = Math.max(-3, Math.min(3, x));
        // a step every so often, timed off how far you have walked
        bob += speed * 2.4;
        if (bob - lastStep > 1.5) {
          lastStep = bob;
          step(0.8 + Math.random() * 0.4);
        }
      }

      // bring the street back around behind you
      for (const m of movers) {
        m.obj.position.z += 0;
        if (m.obj.position.z - z > 14) m.obj.position.z -= m.gap;
        if (m.obj.position.z - z < -m.gap + 14) m.obj.position.z += m.gap;
      }

      // windows come on and go off in their own time
      if (Math.random() < 0.004 && litWindows.length) {
        const win = litWindows[Math.floor(Math.random() * litWindows.length)];
        win.material = win.material === winOn ? winOff : winOn;
      }

      camera.position.set(x, EYE + Math.sin(bob * 2) * (moving ? 0.022 : 0.004), z);
      camera.rotation.set(0, 0, 0);
      camera.rotateY(yaw);
      camera.rotateX(pitch);
      camera.rotateZ(Math.sin(bob) * (moving ? 0.006 : 0.001));

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
          if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
          else m.dispose();
        }
      });
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      closeAudio();
    };
  }, []);

  return (
    <div className={s.stage} ref={mountRef}>
      {!locked ? <span className={s.prompt}>click to look around</span> : null}
    </div>
  );
}
