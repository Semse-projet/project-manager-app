"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/**
 * Local panorama inspector only. src is an object URL created from a file the
 * user selected on this device; never send it to an API or an external CDN.
 * It is not photogrammetry, BIM, 3D reconstruction or a verified as-built.
 */
export function LocalPanoramaViewer({ src }: { src: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setWebglFailed(true);
      return;
    }

    let disposed = false;
    const scene = new THREE.Scene();
    const geometry = new THREE.SphereGeometry(50, 64, 40);
    geometry.scale(-1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
    let longitude = 0;
    let latitude = 0;
    let pointerId: number | null = null;
    let lastX = 0;
    let lastY = 0;

    function renderView() {
      if (disposed) return;
      const phi = THREE.MathUtils.degToRad(90 - latitude);
      const theta = THREE.MathUtils.degToRad(longitude);
      camera.lookAt(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      );
      renderer.render(scene, camera);
    }

    const canvas = renderer.domElement;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.touchAction = "none";
    canvas.tabIndex = 0;
    canvas.setAttribute("aria-label", "Recorrido panorámico de 360 grados. Usa el dedo, el mouse o las flechas para girar.");
    container.appendChild(canvas);

    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      renderView();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (pointerId !== null) return;
      pointerId = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (pointerId !== event.pointerId) return;
      longitude += (lastX - event.clientX) * 0.15;
      latitude = THREE.MathUtils.clamp(latitude + (event.clientY - lastY) * 0.15, -85, 85);
      lastX = event.clientX;
      lastY = event.clientY;
      renderView();
    };
    const onPointerEnd = (event: PointerEvent) => {
      if (pointerId !== event.pointerId) return;
      pointerId = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      camera.fov = THREE.MathUtils.clamp(camera.fov + event.deltaY * 0.035, 35, 95);
      camera.updateProjectionMatrix();
      renderView();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowLeft": longitude -= 6; break;
        case "ArrowRight": longitude += 6; break;
        case "ArrowUp": latitude = Math.min(85, latitude + 6); break;
        case "ArrowDown": latitude = Math.max(-85, latitude - 6); break;
        case "+":
        case "=": camera.fov = Math.max(35, camera.fov - 5); camera.updateProjectionMatrix(); break;
        case "-": camera.fov = Math.min(95, camera.fov + 5); camera.updateProjectionMatrix(); break;
        default: return;
      }
      event.preventDefault();
      renderView();
    };

    const texture = new THREE.TextureLoader().load(
      src,
      () => {
        if (disposed) return;
        texture.colorSpace = THREE.SRGBColorSpace;
        material.map = texture;
        material.needsUpdate = true;
        renderView();
      },
      undefined,
      () => { if (!disposed) setWebglFailed(true); },
    );

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerEnd);
    canvas.addEventListener("pointercancel", onPointerEnd);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("keydown", onKeyDown);
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    return () => {
      disposed = true;
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerEnd);
      canvas.removeEventListener("pointercancel", onPointerEnd);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("keydown", onKeyDown);
      sphere.geometry.dispose();
      material.dispose();
      texture.dispose();
      renderer.dispose();
      if (canvas.parentNode === container) container.removeChild(canvas);
    };
  }, [src]);

  if (webglFailed) {
    return (
      <div className="space-y-3">
        <p role="status" className="text-sm text-[var(--warn)]">
          Este dispositivo no pudo abrir el visor interactivo. Se muestra la imagen original sin movimiento 360°.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Imagen panorámica original sin visor WebGL" className="max-h-[480px] w-full rounded-lg object-contain" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-[350px] w-full overflow-hidden rounded-lg bg-[var(--raised)] sm:h-[480px]"
      aria-label="Área de visualización de panorama 360 grados"
    />
  );
}
