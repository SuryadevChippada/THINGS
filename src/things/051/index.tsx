"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import s from "./museum.module.css";

const EYE = 1.65;

/**
 * 051 — MUSEUM OF ONE OBJECT
 *
 * A serious building. Marble, high ceilings, careful lighting, a long
 * approach through two galleries, and a single exhibit at the end of it
 * under its own spotlight, behind glass, on a plinth, with a label.
 *
 * It is a spoon. The building has been designed to make you walk a long
 * way to look at a spoon, and the walk is the exhibit.
 */
export default function MuseumOfOneObject() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [locked, setLocked] = useState(false);
  const [atExhibit, setAtExhibit] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x0d0d0d);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x101012, 22, 90);
    const camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.1, 140);

    const marble = new THREE.MeshStandardMaterial({ color: 0xb9b4a9, roughness: 0.32, metalness: 0.05 });
    const wall = new THREE.MeshStandardMaterial({ color: 0xd8d3c8, roughness: 0.9 });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(26, 120), marble);
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = -50;
    floor.receiveShadow = true;
    scene.add(floor);

    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(26, 120), wall);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, 9, -50);
    scene.add(ceiling);

    for (const side of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(120, 9), wall);
      w.rotation.y = side * -Math.PI / 2;
      w.position.set(side * 13, 4.5, -50);
      w.receiveShadow = true;
      scene.add(w);
    }

    // the long approach: colonnades, and an arch between the galleries
    const columnGeo = new THREE.CylinderGeometry(0.6, 0.68, 9, 20);
    for (let i = 0; i < 14; i++) {
      for (const side of [-1, 1]) {
        const col = new THREE.Mesh(columnGeo, marble);
        col.position.set(side * 8.5, 4.5, -6 - i * 7);
        col.castShadow = true;
        scene.add(col);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 1.8), marble);
        cap.position.set(side * 8.5, 9.1, -6 - i * 7);
        scene.add(cap);
      }
    }

    // dim uplighters down the hall
    scene.add(new THREE.AmbientLight(0x9aa2b0, 0.35));
    for (let i = 0; i < 7; i++) {
      const lamp = new THREE.PointLight(0xffe6c0, 16, 26, 2);
      lamp.position.set(0, 7.4, -8 - i * 13);
      scene.add(lamp);
    }

    // --- the exhibit ---------------------------------------------
    const EXHIBIT_Z = -86;

    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(26, 9), wall);
    backWall.position.set(0, 4.5, EXHIBIT_Z - 8);
    backWall.receiveShadow = true;
    scene.add(backWall);

    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.05, 1.5, 32), marble);
    plinth.position.set(0, 0.75, EXHIBIT_Z);
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    scene.add(plinth);

    // the case
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 1.9, 1.5),
      new THREE.MeshPhysicalMaterial({
        color: 0xd8e4ee,
        transparent: true,
        opacity: 0.1,
        roughness: 0.02,
        transmission: 0.75,
      }),
    );
    glass.position.set(0, 2.45, EXHIBIT_Z);
    scene.add(glass);

    // the spoon, treated with total seriousness
    const spoonMat = new THREE.MeshStandardMaterial({
      color: 0xd6d8dc,
      roughness: 0.16,
      metalness: 0.95,
    });
    const spoon = new THREE.Group();
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 16), spoonMat);
    bowl.scale.set(1, 0.36, 1.5);
    bowl.position.y = 0.02;
    spoon.add(bowl);
    const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.5, 4, 10), spoonMat);
    handle.rotation.x = Math.PI / 2;
    handle.position.set(0, 0.03, -0.44);
    spoon.add(handle);
    spoon.position.set(0, 2.2, EXHIBIT_Z);
    spoon.rotation.x = -0.22;
    spoon.castShadow = true;
    scene.add(spoon);

    // its own light, of course
    const spot = new THREE.SpotLight(0xfff4e2, 90, 14, 0.32, 0.55, 2);
    spot.position.set(0, 8, EXHIBIT_Z);
    spot.target = spoon;
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    scene.add(spot);
    scene.add(spot.target);

    // the label
    const labelCanvas = document.createElement("canvas");
    labelCanvas.width = 1024;
    labelCanvas.height = 512;
    const lctx = labelCanvas.getContext("2d");
    if (lctx) {
      lctx.fillStyle = "#efece5";
      lctx.fillRect(0, 0, 1024, 512);
      lctx.fillStyle = "#22201d";
      lctx.textAlign = "center";
      lctx.font = "italic 62px Georgia, serif";
      lctx.fillText("Spoon", 512, 130);
      lctx.font = "34px Georgia, serif";
      lctx.fillText("Maker unknown", 512, 200);
      lctx.fillText("Stainless steel", 512, 250);
      lctx.fillText("c. 2019", 512, 300);
      lctx.font = "italic 27px Georgia, serif";
      lctx.fillText("On long-term loan from a kitchen drawer.", 512, 380);
      lctx.font = "24px Georgia, serif";
      lctx.fillText("Please do not touch the glass.", 512, 430);
    }
    const labelTex = new THREE.CanvasTexture(labelCanvas);
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 1.3),
      new THREE.MeshBasicMaterial({ map: labelTex }),
    );
    label.position.set(3.6, 2.1, EXHIBIT_Z - 7.9);
    scene.add(label);

    // --- walking --------------------------------------------------
    let px = 0;
    let pz = 4;
    let yaw = 0;
    let pitch = 0;
    let bob = 0;
    const keys = new Set<string>();

    const onKeyDown = (e: KeyboardEvent) => keys.add(e.code);
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== renderer.domElement) return;
      yaw -= e.movementX * 0.002;
      pitch = Math.max(-1, Math.min(1, pitch - e.movementY * 0.002));
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
    let wasNear = false;

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
      const speed = 3.4 * (keys.has("ShiftLeft") ? 1.9 : 1) * dt;
      if (moving) {
        const len = Math.hypot(fwd, strafe) || 1;
        px += ((-Math.sin(yaw) * fwd + Math.cos(yaw) * strafe) / len) * speed;
        pz += ((-Math.cos(yaw) * fwd - Math.sin(yaw) * strafe) / len) * speed;
        px = Math.max(-12, Math.min(12, px));
        pz = Math.max(EXHIBIT_Z - 6, Math.min(8, pz));
        bob += speed * 2;
      }

      // do not let anyone walk through the exhibit
      const toExhibit = Math.hypot(px, pz - EXHIBIT_Z);
      if (toExhibit < 2.2) {
        px = (px / (toExhibit || 1)) * 2.2;
        pz = EXHIBIT_Z + ((pz - EXHIBIT_Z) / (toExhibit || 1)) * 2.2;
      }

      const near = toExhibit < 6;
      if (near !== wasNear) {
        wasNear = near;
        setAtExhibit(near);
      }

      spoon.rotation.y += dt * 0.22;

      camera.position.set(px, EYE + Math.sin(bob * 2) * (moving ? 0.02 : 0.003), pz);
      camera.rotation.set(0, 0, 0);
      camera.rotateY(yaw);
      camera.rotateX(pitch);

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
      labelTex.dispose();
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
      {atExhibit ? <span className={s.plaque}>the collection</span> : null}
      {!locked ? <span className={s.prompt}>click to look around</span> : null}
    </div>
  );
}
