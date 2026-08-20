"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { getAudio, closeAudio } from "@/lib/audio";
import s from "./waiting.module.css";

/**
 * 029 — THE WAITING ROOM
 *
 * Fluorescent light, plastic chairs, a clock that works, and a display
 * that calls numbers.
 *
 * Your ticket is 47. The display advances every so often, in its own
 * time, and it is never going to reach you — it skips, it goes backwards
 * once in a while, and occasionally it just sits there. There is nothing
 * to do and nothing to solve. You can sit down if you like.
 */
export default function WaitingRoom() {
  const mountRef = useRef<HTMLDivElement>(null);
  /** Lets the number change without rebuilding the whole room. */
  const paintRef = useRef<((n: number) => void) | null>(null);
  const calledRef = useRef(38);

  const [now, setNow] = useState("");
  const [called, setCalled] = useState(38);

  useEffect(() => {
    calledRef.current = called;
    paintRef.current?.(called);
  }, [called]);

  // the display, doing its best
  useEffect(() => {
    const timer = window.setInterval(() => {
      setCalled((n) => {
        const roll = Math.random();
        if (roll < 0.16) return n; // nothing happens
        if (roll < 0.26) return Math.max(21, n - 1 - Math.floor(Math.random() * 2));
        // it will not pass 46
        return n >= 46 ? 39 + Math.floor(Math.random() * 5) : n + 1;
      });
    }, 4200);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow(
        `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
      );
    };
    tick();
    const timer = window.setInterval(tick, 10000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x0d0d0d);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 60);
    camera.position.set(0, 1.35, 4.2);

    const wallMat = new THREE.MeshLambertMaterial({ color: 0x9aa096, side: THREE.BackSide });
    const room = new THREE.Mesh(new THREE.BoxGeometry(11, 3.4, 12), wallMat);
    room.position.y = 1.4;
    scene.add(room);

    // the lower half of the wall is that particular institutional green
    const dado = new THREE.Mesh(
      new THREE.BoxGeometry(10.94, 1.1, 11.94),
      new THREE.MeshLambertMaterial({ color: 0x5f6f5e, side: THREE.BackSide }),
    );
    dado.position.y = 0.55;
    scene.add(dado);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 12),
      new THREE.MeshLambertMaterial({ color: 0x6d6a63 }),
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    scene.add(new THREE.AmbientLight(0xbfd0c4, 0.5));

    // strip lights, humming
    const tubes: THREE.PointLight[] = [];
    for (const z of [-3.4, 0.4]) {
      const housing = new THREE.Mesh(
        new THREE.BoxGeometry(3.4, 0.08, 0.3),
        new THREE.MeshBasicMaterial({ color: 0xf2f6ee }),
      );
      housing.position.set(0, 3.02, z);
      scene.add(housing);
      const light = new THREE.PointLight(0xdfe9dd, 22, 16, 2);
      light.position.set(0, 2.9, z);
      scene.add(light);
      tubes.push(light);
    }

    // chairs, bolted in a row, all facing the display
    const seatMat = new THREE.MeshLambertMaterial({ color: 0x3f5d70 });
    const frameMat = new THREE.MeshLambertMaterial({ color: 0x4a4a4c });
    for (let i = 0; i < 5; i++) {
      const chair = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.07, 0.5), seatMat);
      seat.position.y = 0.44;
      chair.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.5, 0.07), seatMat);
      back.position.set(0, 0.7, -0.22);
      chair.add(back);
      for (const dx of [-0.22, 0.22]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.44, 0.04), frameMat);
        leg.position.set(dx, 0.22, 0);
        chair.add(leg);
      }
      chair.position.set(-1.3 + i * 0.65, 0, -1.8);
      scene.add(chair);
    }

    // the display
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.85, 0.12),
      new THREE.MeshLambertMaterial({ color: 0x1b1c1e }),
    );
    board.position.set(0, 2.05, -5.9);
    scene.add(board);

    const numberCanvas = document.createElement("canvas");
    numberCanvas.width = 512;
    numberCanvas.height = 256;
    const nctx = numberCanvas.getContext("2d");
    const numberTex = new THREE.CanvasTexture(numberCanvas);
    const numberPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, 0.7),
      new THREE.MeshBasicMaterial({ map: numberTex, transparent: true }),
    );
    numberPlane.position.set(0, 2.05, -5.83);
    scene.add(numberPlane);

    // a clock that tells the truth, which does not help
    const clockFace = new THREE.Mesh(
      new THREE.CircleGeometry(0.34, 32),
      new THREE.MeshLambertMaterial({ color: 0xe8e6df }),
    );
    clockFace.position.set(-3.2, 2.2, -5.9);
    scene.add(clockFace);
    const hands = new THREE.Group();
    hands.position.copy(clockFace.position);
    hands.position.z += 0.02;
    scene.add(hands);
    const handMat = new THREE.MeshBasicMaterial({ color: 0x25241f });
    const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.17, 0.01), handMat);
    hourHand.geometry.translate(0, 0.085, 0);
    hands.add(hourHand);
    const minuteHand = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.25, 0.01), handMat);
    minuteHand.geometry.translate(0, 0.125, 0);
    hands.add(minuteHand);
    const secondHand = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.28, 0.01), new THREE.MeshBasicMaterial({ color: 0x8c3a2f }));
    secondHand.geometry.translate(0, 0.14, 0);
    hands.add(secondHand);

    // the hum of the lights, which you stop hearing and then hear again
    const ac = getAudio();
    if (ac) {
      const hum = ac.createOscillator();
      hum.type = "sawtooth";
      hum.frequency.value = 100;
      const lp = ac.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 340;
      const gain = ac.createGain();
      gain.gain.value = 0.022;
      hum.connect(lp).connect(gain).connect(ac.destination);
      hum.start();
    }

    const look = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      look.x = (e.clientX / window.innerWidth - 0.5) * 0.7;
      look.y = (e.clientY / window.innerHeight - 0.5) * 0.3;
    };
    window.addEventListener("pointermove", onMove);

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    let raf = 0;
    const frame = (t: number) => {
      const d = new Date();
      secondHand.rotation.z = -(d.getSeconds() / 60) * Math.PI * 2;
      minuteHand.rotation.z = -(d.getMinutes() / 60) * Math.PI * 2;
      hourHand.rotation.z = -((d.getHours() % 12) / 12) * Math.PI * 2;

      // one of the tubes is on its way out
      tubes[1].intensity = Math.random() > 0.02 ? 22 : 5;

      camera.rotation.set(0, 0, 0);
      camera.rotateY(-look.x);
      camera.rotateX(-look.y);
      camera.position.y = 1.35 + Math.sin(t / 2600) * 0.01;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // repaint the display whenever the number changes
    const paint = (value: number) => {
      if (!nctx) return;
      nctx.clearRect(0, 0, 512, 256);
      nctx.fillStyle = "#d8632f";
      nctx.font = "700 150px ui-monospace, monospace";
      nctx.textAlign = "center";
      nctx.textBaseline = "middle";
      nctx.fillText(String(value).padStart(3, "0"), 256, 132);
      nctx.font = "600 30px ui-monospace, monospace";
      nctx.fillText("NOW SERVING", 256, 34);
      numberTex.needsUpdate = true;
    };
    paintRef.current = paint;
    paint(calledRef.current);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", onResize);
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const m = obj.material;
          if (Array.isArray(m)) m.forEach((x) => x.dispose());
          else m.dispose();
        }
      });
      numberTex.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      closeAudio();
    };
  }, []);

  return (
    <div className={s.stage}>
      <div ref={mountRef} className={s.scene} />
      <div className={s.ticket}>
        <span className={s.ticketLabel}>your number</span>
        <span className={s.ticketNumber}>047</span>
        <span className={s.ticketTime}>{now}</span>
      </div>
    </div>
  );
}
