"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * 019 — ONE LIGHTBULB
 *
 * A bulb on a cord in an empty room. Grab it, pull it, let it go.
 *
 * There is no physics engine here — a bulb on a wire is a pendulum, and a
 * pendulum is two angles and some damping. Doing it directly means the
 * swing can be tuned by feel rather than by tuning a solver, and the light
 * and its shadows come along for free because the lamp *is* the light.
 */
export default function OneLightbulb() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x0d0d0d);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 60);
    camera.position.set(0, 1.5, 6.2);
    camera.lookAt(0, 1.1, 0);

    // the room, seen from inside
    const room = new THREE.Mesh(
      new THREE.BoxGeometry(14, 9, 14),
      new THREE.MeshStandardMaterial({ color: 0x6b6660, roughness: 1, side: THREE.BackSide }),
    );
    room.position.y = 2.4;
    room.receiveShadow = true;
    scene.add(room);

    // something to cast shadows onto, so the swing is readable
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 1.5, 1.5),
      new THREE.MeshStandardMaterial({ color: 0x7a746c, roughness: 0.95 }),
    );
    plinth.position.set(-2.1, -1.35, -1.2);
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    scene.add(plinth);

    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 3.4, 16),
      new THREE.MeshStandardMaterial({ color: 0x74706a, roughness: 0.9 }),
    );
    pipe.position.set(2.5, -0.4, -1.6);
    pipe.castShadow = true;
    pipe.receiveShadow = true;
    scene.add(pipe);

    scene.add(new THREE.AmbientLight(0x8894a4, 0.12));

    // --- the bulb ------------------------------------------------
    const ANCHOR = new THREE.Vector3(0, 4.6, 0);
    const LENGTH = 2.9;

    const rig = new THREE.Group();
    scene.add(rig);

    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, LENGTH, 6),
      new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 1 }),
    );
    cord.position.y = -LENGTH / 2;
    rig.add(cord);

    const fitting = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.11, 0.22, 16),
      new THREE.MeshStandardMaterial({ color: 0x8a8078, roughness: 0.55, metalness: 0.6 }),
    );
    fitting.position.y = -LENGTH - 0.06;
    rig.add(fitting);

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xfff0d0,
      emissive: 0xffd9a0,
      emissiveIntensity: 2.4,
      roughness: 0.35,
      transparent: true,
      opacity: 0.95,
    });
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 18), glassMat);
    glass.position.y = -LENGTH - 0.3;
    rig.add(glass);

    const lamp = new THREE.PointLight(0xffd9a8, 34, 26, 2);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(1024, 1024);
    lamp.shadow.bias = -0.004;
    lamp.position.copy(glass.position);
    rig.add(lamp);

    rig.position.copy(ANCHOR);

    // --- the pendulum --------------------------------------------
    // two angles: swing toward the camera, and swing across it
    let ax = 0.05;
    let az = 0.13;
    let vx = 0;
    let vz = 0;
    let held = false;

    const bulbScreen = new THREE.Vector3();
    const pointer = new THREE.Vector2();

    const bulbWorld = () => {
      const v = new THREE.Vector3(0, -LENGTH - 0.3, 0);
      rig.updateMatrixWorld();
      return v.applyMatrix4(rig.matrixWorld);
    };

    const onDown = (e: PointerEvent) => {
      bulbScreen.copy(bulbWorld()).project(camera);
      const bx = ((bulbScreen.x + 1) / 2) * window.innerWidth;
      const by = ((-bulbScreen.y + 1) / 2) * window.innerHeight;
      if (Math.hypot(e.clientX - bx, e.clientY - by) < 70) {
        held = true;
        renderer.domElement.setPointerCapture(e.pointerId);
      }
    };
    const onMove = (e: PointerEvent) => {
      pointer.set(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1,
      );
      if (!held) return;
      // drag the bulb around, and it drags the cord with it
      const targetZ = Math.max(-1.1, Math.min(1.1, pointer.x * 1.5));
      const targetX = Math.max(-0.9, Math.min(0.9, -pointer.y * 1.1 - 0.3));
      vz += (targetZ - az) * 0.35;
      vx += (targetX - ax) * 0.35;
      az += (targetZ - az) * 0.35;
      ax += (targetX - ax) * 0.35;
    };
    const onUp = () => {
      held = false;
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

      if (!held) {
        // gravity restores it, air and the fitting take the energy away
        const g = 9.81 / LENGTH;
        vx += -g * Math.sin(ax) * dt;
        vz += -g * Math.sin(az) * dt;
        vx *= 0.998;
        vz *= 0.998;
        ax += vx * dt;
        az += vz * dt;
      }

      rig.rotation.set(ax, 0, az);

      // a filament that never quite settles
      const swing = Math.hypot(vx, vz);
      glassMat.emissiveIntensity = 2.2 + Math.sin(now / 90) * 0.08 + swing * 0.5;
      lamp.intensity = 32 + Math.sin(now / 130) * 1.4 + swing * 5;

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

  return <div ref={mountRef} style={{ position: "fixed", inset: 0, cursor: "grab" }} />;
}
