"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import s from "./stairs.module.css";

const TAU = Math.PI * 2;

// The stairwell. One turn is one floor.
const STEPS_PER_TURN = 18;
const STEP_RISE = 0.19;
const STEP_ANGLE = TAU / STEPS_PER_TURN;
const R_IN = 1.5;
const R_OUT = 4.3;
const EYE = 1.62;

/** How much of the shaft exists at any moment. The fog hides the rest. */
const TURNS_BELOW = 2;
const TURNS_ABOVE = 3;
const STEP_COUNT = (TURNS_BELOW + TURNS_ABOVE) * STEPS_PER_TURN;

/** Floors where the building is not quite identical to itself. */
const ODDITIES = { plant: 12, chair: 27, flicker: 46, window: 71, message: 103 };

/**
 * 008 — INFINITE STAIRCASE
 *
 * A concrete stairwell that goes up forever. WASD and the mouse; hold
 * shift to hurry, which will not help.
 *
 * The shaft is not modelled floor by floor — your height is a pure
 * function of how far around the core you have walked, so the stairs can
 * repeat indefinitely without anything accumulating. Every few floors the
 * building forgets to be identical: a plant on 12, a chair on 27, a light
 * that can't hold on 46, a window on 71, and something written on 103.
 */
export default function InfiniteStaircase() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [floor, setFloor] = useState(1);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x0d0d0d);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0d0d0d, 0.058);

    const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 90);

    // --- the shaft ------------------------------------------------
    /** Poured concrete, generated rather than shipped. */
    const grain = (() => {
      const c = document.createElement("canvas");
      c.width = c.height = 256;
      const g = c.getContext("2d");
      if (g) {
        g.fillStyle = "#8a857d";
        g.fillRect(0, 0, 256, 256);
        const img = g.getImageData(0, 0, 256, 256);
        for (let i = 0; i < img.data.length; i += 4) {
          const n = (Math.random() - 0.5) * 46;
          img.data[i] += n;
          img.data[i + 1] += n;
          img.data[i + 2] += n;
        }
        g.putImageData(img, 0, 0);
        // pour lines and the odd blemish
        g.fillStyle = "rgba(0,0,0,0.06)";
        for (let i = 0; i < 40; i++) {
          g.fillRect(0, Math.random() * 256, 256, Math.random() * 2);
        }
        for (let i = 0; i < 22; i++) {
          g.beginPath();
          g.arc(Math.random() * 256, Math.random() * 256, Math.random() * 9, 0, TAU);
          g.fill();
        }
      }
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(3, 3);
      return tex;
    })();

    const concrete = new THREE.MeshLambertMaterial({ color: 0x78787a, map: grain });
    const darker = new THREE.MeshLambertMaterial({ color: 0x55565a, map: grain });

    const shape = new THREE.Shape();
    shape.absarc(0, 0, R_OUT, 0, STEP_ANGLE, false);
    shape.absarc(0, 0, R_IN, STEP_ANGLE, 0, true);
    const stepGeo = new THREE.ExtrudeGeometry(shape, {
      depth: STEP_RISE + 0.07,
      bevelEnabled: false,
      curveSegments: 6,
    });
    stepGeo.rotateX(-Math.PI / 2); // lie flat, extruding downward

    const steps = new THREE.InstancedMesh(stepGeo, concrete, STEP_COUNT);
    steps.frustumCulled = false;
    scene.add(steps);

    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(R_IN, R_IN, 60, 24, 1, true),
      darker,
    );
    scene.add(core);

    const outer = new THREE.Mesh(
      new THREE.CylinderGeometry(R_OUT + 0.35, R_OUT + 0.35, 60, 32, 1, true),
      new THREE.MeshLambertMaterial({ color: 0x67686c, map: grain, side: THREE.BackSide }),
    );
    scene.add(outer);

    scene.add(new THREE.AmbientLight(0x76828f, 0.85));

    // A few lamps that leapfrog upward with you, one per floor.
    const lamps = Array.from({ length: 5 }, () => {
      const light = new THREE.PointLight(0xffcb96, 26, 22, 2);
      scene.add(light);
      return light;
    });

    // --- the things that aren't concrete ---------------------------
    const oddities = new THREE.Group();
    scene.add(oddities);
    const disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [stepGeo, grain];

    const place = (obj: THREE.Object3D, floorNo: number, angleInTurn: number, radius: number) => {
      const theta = (floorNo - 1) * TAU + angleInTurn;
      obj.position.set(
        Math.cos(theta) * radius,
        Math.floor(theta / STEP_ANGLE) * STEP_RISE,
        Math.sin(theta) * radius,
      );
      obj.rotation.y = -theta;
      obj.userData.floor = floorNo;
      oddities.add(obj);
    };

    // 12 — a plant nobody waters
    const plant = new THREE.Group();
    const potMat = new THREE.MeshLambertMaterial({ color: 0x8a5a3e });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x4a6b43 });
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.26, 10), potMat);
    pot.position.y = 0.13;
    plant.add(pot);
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.42, 5), leafMat);
      const a = (i / 6) * TAU;
      leaf.position.set(Math.cos(a) * 0.08, 0.44, Math.sin(a) * 0.08);
      leaf.rotation.z = Math.cos(a) * 0.5;
      leaf.rotation.x = Math.sin(a) * 0.5;
      plant.add(leaf);
    }
    disposables.push(potMat, leafMat);
    place(plant, ODDITIES.plant, 0.9, R_OUT - 0.65);

    // 27 — a chair, facing the wall
    const chair = new THREE.Group();
    const chairMat = new THREE.MeshLambertMaterial({ color: 0x7a6a52 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.42), chairMat);
    seat.position.y = 0.44;
    chair.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.46, 0.05), chairMat);
    back.position.set(0, 0.67, -0.19);
    chair.add(back);
    for (const [dx, dz] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.44, 0.045), chairMat);
      leg.position.set(dx, 0.22, dz);
      chair.add(leg);
    }
    disposables.push(chairMat);
    place(chair, ODDITIES.chair, 2.6, R_OUT - 0.9);

    // 71 — a window, and no view
    const windowMat = new THREE.MeshBasicMaterial({ color: 0x8fa6bd });
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.5), windowMat);
    disposables.push(windowMat);
    place(win, ODDITIES.window, 1.6, R_OUT + 0.33);
    win.rotation.y += Math.PI / 2;
    win.position.y += 1.5;
    const winGlow = new THREE.PointLight(0x9ab6d4, 30, 14, 2);
    winGlow.position.copy(win.position);
    oddities.add(winGlow);
    winGlow.userData.floor = ODDITIES.window;

    // 103 — something written on the wall
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 256;
    const c2d = canvas.getContext("2d");
    if (c2d) {
      c2d.fillStyle = "#00000000";
      c2d.clearRect(0, 0, canvas.width, canvas.height);
      c2d.font = "600 76px ui-monospace, monospace";
      c2d.fillStyle = "#b9b3aa";
      c2d.textAlign = "center";
      c2d.textBaseline = "middle";
      c2d.fillText("YOU ARE STILL HERE", canvas.width / 2, canvas.height / 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    const messageMat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.55 });
    const message = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.85), messageMat);
    disposables.push(texture, messageMat);
    place(message, ODDITIES.message, 1.2, R_OUT + 0.3);
    message.rotation.y += Math.PI / 2;
    message.position.y += 1.7;

    // --- where you are --------------------------------------------
    let theta = 0.35; // unwrapped: how far around the core you have walked
    let radius = (R_IN + R_OUT) / 2;
    // face along the climb: the tangent at theta, not the wall in front
    let yaw = Math.PI - theta;
    let pitch = 0.1;
    const keys = new Set<string>();

    const heightAt = (t: number) => Math.floor(t / STEP_ANGLE) * STEP_RISE;

    const onKeyDown = (e: KeyboardEvent) => keys.add(e.code);
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== renderer.domElement) return;
      yaw -= e.movementX * 0.0022;
      pitch = Math.max(-1.2, Math.min(1.2, pitch - e.movementY * 0.0022));
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

    const dummy = new THREE.Object3D();
    let lastBase = NaN;
    let shownFloor = 1;
    let raf = 0;
    let last = performance.now();

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      // --- walk ----------------------------------------------------
      const run = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 2.1 : 1;
      const speed = 2.4 * run * dt;
      let fwd = 0;
      let strafe = 0;
      if (keys.has("KeyW") || keys.has("ArrowUp")) fwd += 1;
      if (keys.has("KeyS") || keys.has("ArrowDown")) fwd -= 1;
      if (keys.has("KeyA") || keys.has("ArrowLeft")) strafe -= 1;
      if (keys.has("KeyD") || keys.has("ArrowRight")) strafe += 1;

      if (fwd || strafe) {
        const len = Math.hypot(fwd, strafe) || 1;
        // the camera looks down -Z, so forward is (-sin, -cos); right is (cos, -sin)
        const dirX = (-Math.sin(yaw) * fwd + Math.cos(yaw) * strafe) / len;
        const dirZ = (-Math.cos(yaw) * fwd - Math.sin(yaw) * strafe) / len;

        let x = Math.cos(theta) * radius + dirX * speed;
        let z = Math.sin(theta) * radius + dirZ * speed;

        // the walls are the only thing keeping you on the stairs
        const r = Math.hypot(x, z);
        const clamped = Math.max(R_IN + 0.42, Math.min(R_OUT - 0.42, r));
        if (r !== clamped) {
          x = (x / r) * clamped;
          z = (z / r) * clamped;
        }
        radius = clamped;

        // unwrap, so going around and around actually accumulates
        const raw = Math.atan2(z, x);
        let delta = raw - (theta % TAU);
        if (delta > Math.PI) delta -= TAU;
        if (delta < -Math.PI) delta += TAU;
        theta += delta;
      }

      const y = heightAt(theta);
      camera.position.set(Math.cos(theta) * radius, y + EYE, Math.sin(theta) * radius);
      camera.rotation.set(0, 0, 0);
      camera.rotateY(yaw);
      camera.rotateX(pitch);

      // --- rebuild the shaft around you ----------------------------
      const baseStep = Math.floor(theta / STEP_ANGLE) - TURNS_BELOW * STEPS_PER_TURN;
      if (baseStep !== lastBase) {
        lastBase = baseStep;
        for (let i = 0; i < STEP_COUNT; i++) {
          const gi = baseStep + i;
          dummy.position.set(0, gi * STEP_RISE, 0);
          dummy.rotation.set(0, -gi * STEP_ANGLE, 0);
          dummy.updateMatrix();
          steps.setMatrixAt(i, dummy.matrix);
        }
        steps.instanceMatrix.needsUpdate = true;

        core.position.y = y;
        outer.position.y = y;

        // lamps sit one per floor, following you up the shaft
        const baseTurn = Math.floor(theta / TAU) - 1;
        lamps.forEach((lamp, i) => {
          const t = (baseTurn + i) * TAU + 1.9;
          lamp.position.set(
            Math.cos(t) * (R_OUT - 0.5),
            heightAt(t) + 2.4,
            Math.sin(t) * (R_OUT - 0.5),
          );
          lamp.userData.turn = baseTurn + i;
        });

        // only show an oddity when you are near its floor
        const currentFloor = Math.floor(theta / TAU) + 1;
        oddities.children.forEach((obj) => {
          obj.visible = Math.abs((obj.userData.floor as number) - currentFloor) <= 2;
        });
        if (currentFloor !== shownFloor) {
          shownFloor = currentFloor;
          setFloor(currentFloor);
        }
      }

      // 46 — the light that can't hold
      const flickerTurn = ODDITIES.flicker - 1;
      lamps.forEach((lamp) => {
        lamp.intensity =
          lamp.userData.turn === flickerTurn
            ? (Math.random() > 0.14 ? 26 : 2.5) * (0.7 + Math.random() * 0.4)
            : 26;
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
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className={s.stage} ref={mountRef}>
      <span className={s.floor} key={floor}>
        {floor}
      </span>
      {!locked ? <span className={s.prompt}>click to look around</span> : null}
    </div>
  );
}
