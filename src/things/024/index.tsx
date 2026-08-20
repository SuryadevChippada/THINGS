"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { getAudio, closeAudio } from "@/lib/audio";

const TAU = Math.PI * 2;
/** How far ahead the world exists before it is recycled behind you. */
const SPAN = 220;

/**
 * 024 — NIGHT DRIVE
 *
 * You are in the passenger seat. It is raining, it is late, and the car
 * is not going anywhere in particular.
 *
 * Nothing here is generated ahead of you and stored — the streetlights,
 * buildings and road markings are a fixed pool of objects that get moved
 * back to the horizon once they pass the car, so the drive can go on
 * indefinitely at a constant cost. There is no destination and nothing to
 * do, which is the entire idea.
 */
export default function NightDrive() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x0d0d0d);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0d0d0d, 26, 165);

    const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 220);
    camera.position.set(-1.5, 1.5, 0);

    scene.add(new THREE.AmbientLight(0x2a3444, 1.1));
    const moon = new THREE.DirectionalLight(0x5a6d8a, 0.5);
    moon.position.set(-8, 20, -14);
    scene.add(moon);

    // --- the road ------------------------------------------------
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(16, SPAN * 2),
      new THREE.MeshStandardMaterial({ color: 0x16171a, roughness: 0.32, metalness: 0.25 }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.z = -SPAN / 2;
    scene.add(road);

    const verge = new THREE.Mesh(
      new THREE.PlaneGeometry(90, SPAN * 2),
      new THREE.MeshStandardMaterial({ color: 0x14150f, roughness: 1 }),
    );
    verge.rotation.x = -Math.PI / 2;
    verge.position.set(0, -0.02, -SPAN / 2);
    scene.add(verge);

    /** Anything that scrolls past the car and gets recycled. */
    const movers: { obj: THREE.Object3D; gap: number }[] = [];

    // centre line
    const dashGeo = new THREE.PlaneGeometry(0.16, 3.2);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0x8a8574 });
    for (let i = 0; i < 30; i++) {
      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(0, 0.01, -i * 7.5);
      scene.add(dash);
      movers.push({ obj: dash, gap: 30 * 7.5 });
    }

    // streetlights, down the right-hand side
    const lampPost = new THREE.CylinderGeometry(0.09, 0.11, 7, 6);
    const lampArm = new THREE.BoxGeometry(1.5, 0.09, 0.09);
    const lampHead = new THREE.SphereGeometry(0.24, 10, 8);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.9 });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });

    for (let i = 0; i < 12; i++) {
      const group = new THREE.Group();
      const post = new THREE.Mesh(lampPost, postMat);
      post.position.y = 3.5;
      group.add(post);
      const arm = new THREE.Mesh(lampArm, postMat);
      arm.position.set(-0.75, 6.9, 0);
      group.add(arm);
      const head = new THREE.Mesh(lampHead, bulbMat);
      head.position.set(-1.45, 6.8, 0);
      group.add(head);

      const glow = new THREE.PointLight(0xffc98a, 55, 30, 2);
      glow.position.set(-1.45, 6.6, 0);
      group.add(glow);

      group.position.set(9, 0, -i * 22);
      scene.add(group);
      movers.push({ obj: group, gap: 12 * 22 });
    }

    // buildings, further out, mostly dark with the odd lit window
    const blockGeo = new THREE.BoxGeometry(1, 1, 1);
    const blockMat = new THREE.MeshStandardMaterial({ color: 0x191a1e, roughness: 1 });
    const windowMat = new THREE.MeshBasicMaterial({ color: 0xd8b878 });
    for (let i = 0; i < 44; i++) {
      const side = i % 2 ? 1 : -1;
      const group = new THREE.Group();
      const hgt = 6 + Math.random() * 22;
      const wid = 5 + Math.random() * 8;
      const block = new THREE.Mesh(blockGeo, blockMat);
      block.scale.set(wid, hgt, 6 + Math.random() * 8);
      block.position.y = hgt / 2;
      group.add(block);

      // a handful of people still awake
      const lit = Math.floor(Math.random() * 7);
      for (let k = 0; k < lit; k++) {
        const win = new THREE.Mesh(blockGeo, windowMat);
        win.scale.set(0.5, 0.7, 0.1);
        win.position.set(
          (Math.random() - 0.5) * wid * 0.7,
          1.5 + Math.random() * (hgt - 3),
          (side < 0 ? 1 : -1) * (block.scale.z / 2 + 0.06),
        );
        group.add(win);
      }

      group.position.set(side * (20 + Math.random() * 16), 0, -(i / 2) * 20 - Math.random() * 10);
      scene.add(group);
      movers.push({ obj: group, gap: 22 * 20 });
    }

    // --- rain on the glass ---------------------------------------
    // Drawn to a canvas and used as an overlay, because rain on a
    // windscreen is a 2D problem and modelling it in 3D is a waste.
    const rainCanvas = document.createElement("canvas");
    rainCanvas.width = 1024;
    rainCanvas.height = 1024;
    const rctx = rainCanvas.getContext("2d");
    const rainTex = new THREE.CanvasTexture(rainCanvas);
    const rainPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({ map: rainTex, transparent: true, depthTest: false }),
    );
    const rainScene = new THREE.Scene();
    const rainCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    rainScene.add(rainPlane);

    const drops = Array.from({ length: 220 }, () => ({
      x: Math.random() * 1024,
      y: Math.random() * 1024,
      r: 1.6 + Math.random() * 4,
      v: 0,
    }));

    // --- the sound of it ------------------------------------------
    const ac = getAudio();
    if (ac) {
      const frames = Math.ceil(ac.sampleRate * 3);
      const buffer = ac.createBuffer(1, frames, ac.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

      // rain: filtered noise
      const rain = ac.createBufferSource();
      rain.buffer = buffer;
      rain.loop = true;
      const rainFilter = ac.createBiquadFilter();
      rainFilter.type = "bandpass";
      rainFilter.frequency.value = 2400;
      rainFilter.Q.value = 0.5;
      const rainGain = ac.createGain();
      rainGain.gain.value = 0.055;
      rain.connect(rainFilter).connect(rainGain).connect(ac.destination);
      rain.start();

      // the engine, several floors below
      const engine = ac.createOscillator();
      engine.type = "sawtooth";
      engine.frequency.value = 46;
      const engineFilter = ac.createBiquadFilter();
      engineFilter.type = "lowpass";
      engineFilter.frequency.value = 120;
      const engineGain = ac.createGain();
      engineGain.gain.value = 0.05;
      engine.connect(engineFilter).connect(engineGain).connect(ac.destination);
      engine.start();
    }

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    // the passenger looks around a little
    const look = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      look.x = (e.clientX / window.innerWidth - 0.5) * 0.5;
      look.y = (e.clientY / window.innerHeight - 0.5) * 0.22;
    };
    window.addEventListener("pointermove", onMove);

    let raf = 0;
    let last = performance.now();
    const speed = 26;

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      // the world comes to you
      for (const m of movers) {
        m.obj.position.z += speed * dt;
        if (m.obj.position.z > 12) m.obj.position.z -= m.gap;
      }

      // suspension, and a head that isn't bolted down
      camera.position.y = 1.5 + Math.sin(now / 320) * 0.02 + Math.sin(now / 97) * 0.008;
      camera.rotation.set(0, 0, 0);
      camera.rotateY(look.x);
      camera.rotateX(-look.y);
      camera.rotateZ(Math.sin(now / 2400) * 0.006);

      // rain
      if (rctx) {
        rctx.clearRect(0, 0, 1024, 1024);
        for (const d of drops) {
          // drops sit until they are heavy, then run
          if (d.r > 3.6) {
            d.v += dt * 46;
            d.y += d.v * dt;
          }
          if (d.y > 1040) {
            d.y = -10;
            d.x = Math.random() * 1024;
            d.r = 1.6 + Math.random() * 4;
            d.v = 0;
          }
          const g = rctx.createRadialGradient(
            d.x - d.r * 0.3,
            d.y - d.r * 0.3,
            0,
            d.x,
            d.y,
            d.r,
          );
          g.addColorStop(0, "rgba(226,238,250,0.26)");
          g.addColorStop(1, "rgba(120,140,160,0.02)");
          rctx.fillStyle = g;
          rctx.beginPath();
          rctx.arc(d.x, d.y, d.r, 0, TAU);
          rctx.fill();
        }
        rainTex.needsUpdate = true;
      }

      renderer.render(scene, camera);
      renderer.autoClear = false;
      renderer.render(rainScene, rainCam);
      renderer.autoClear = true;

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const m = obj.material;
          if (Array.isArray(m)) m.forEach((x) => x.dispose());
          else m.dispose();
        }
      });
      rainTex.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      closeAudio();
    };
  }, []);

  return <div ref={mountRef} style={{ position: "fixed", inset: 0 }} />;
}
