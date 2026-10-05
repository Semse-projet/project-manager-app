import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  dragToYaw,
  drawFace,
  expressionForMood,
  headTargetFromPointer,
  isClick,
  normalizePointer,
  resolveExpression,
  shouldRender3D,
  type FaceContext,
} from "../../apps/web/lib/prometeo-mascot.ts";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(repoRoot, file), "utf8");

function fakeContext(): FaceContext {
  const noop = () => undefined;
  return {
    canvas: { width: 512, height: 256 },
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    lineCap: "butt",
    shadowColor: "",
    shadowBlur: 0,
    clearRect: noop,
    fillRect: noop,
    beginPath: noop,
    arc: noop,
    ellipse: noop,
    stroke: noop,
    fill: noop,
    moveTo: noop,
    lineTo: noop,
  };
}

test("cada estado del asistente se traduce a una expresión de la marca", () => {
  assert.equal(expressionForMood("idle"), "feliz");
  assert.equal(expressionForMood("thinking"), "pensando");
  assert.equal(expressionForMood("answered"), "guiando");
  assert.equal(expressionForMood("error"), "sorprendido");
  assert.equal(expressionForMood("success"), "confirmado");
});

test("una reacción momentánea gana a la expresión de fondo", () => {
  assert.equal(resolveExpression("thinking", "sorprendido"), "sorprendido");
  assert.equal(resolveExpression("thinking", null), "pensando");
});

test("el cursor se normaliza a [-1, 1] aunque esté lejos del lienzo", () => {
  assert.deepEqual(normalizePointer({ x: 100, y: 100 }, { x: 100, y: 100 }), { x: 0, y: 0 });
  assert.deepEqual(normalizePointer({ x: 5000, y: -5000 }, { x: 0, y: 0 }), { x: 1, y: -1 });
  assert.equal(normalizePointer({ x: 210, y: 0 }, { x: 0, y: 0 }, 420).x, 0.5);
});

test("la cabeza gira como máximo lo permitido (no se rompe el cuello)", () => {
  const max = headTargetFromPointer({ x: 99, y: 99 });
  const min = headTargetFromPointer({ x: -99, y: -99 });
  assert.ok(Math.abs(max.yaw) <= 0.55 + 1e-9 && Math.abs(max.pitch) <= 0.3 + 1e-9);
  assert.equal(min.yaw, -max.yaw);
  assert.deepEqual(headTargetFromPointer({ x: 0, y: 0 }), { yaw: 0, pitch: 0 });
});

test("clic frente a arrastre", () => {
  assert.equal(isClick({ x: 10, y: 10 }, { x: 12, y: 11 }), true);
  assert.equal(isClick({ x: 10, y: 10 }, { x: 40, y: 10 }), false);
});

test("el arrastre gira el modelo con tope de media vuelta a cada lado", () => {
  assert.ok(dragToYaw(0, 50) > 0);
  assert.ok(dragToYaw(0, -50) < 0);
  assert.ok(Math.abs(dragToYaw(0, 99999)) < Math.PI);
  assert.equal(dragToYaw(0.3, 0), 0.3);
});

test("3D solo con WebGL y sin 'reducir movimiento'; si no, imagen de marca", () => {
  assert.equal(shouldRender3D({ webgl: true, reducedMotion: false }), true);
  assert.equal(shouldRender3D({ webgl: false, reducedMotion: false }), false);
  assert.equal(shouldRender3D({ webgl: true, reducedMotion: true }), false);
});

test("cada expresión dibuja un rostro distinto", () => {
  const shapes = {
    feliz: drawFace(fakeContext(), "feliz"),
    pensando: drawFace(fakeContext(), "pensando"),
    guiando: drawFace(fakeContext(), "guiando"),
    sorprendido: drawFace(fakeContext(), "sorprendido"),
    confirmado: drawFace(fakeContext(), "confirmado"),
  };
  assert.deepEqual(shapes.feliz, ["eye:arc", "eye:arc", "mouth:smile"]);
  assert.deepEqual(shapes.sorprendido, ["eye:ring", "eye:ring", "mouth:o"]);
  assert.ok(shapes.pensando.includes("eye:squint") && shapes.pensando.includes("mouth:flat"));
  assert.ok(shapes.guiando.includes("eye:arc") && shapes.guiando.includes("eye:dot"));
  assert.ok(shapes.confirmado.includes("badge:check"));
  const signatures = new Set(Object.values(shapes).map((s) => s.join("|")));
  assert.equal(signatures.size, 5, "las 5 expresiones deben ser distintas entre sí");
});

test("el parpadeo cierra los ojos de la expresión feliz", () => {
  assert.deepEqual(drawFace(fakeContext(), "feliz", true), ["eye:closed", "eye:closed", "mouth:smile"]);
});

test("el widget usa la mascota 3D con estado de ánimo y conserva la imagen de marca como respaldo", () => {
  const widget = read("apps/web/app/components/prometeo/PrometeoCopilot.tsx");
  assert.match(widget, /<PrometeoMascot[^>]*mood=\{shownMood\}[^>]*onActivate=\{\(\) => setOpen\(true\)\}/);
  assert.match(widget, /const shownMood: MascotMood = pending \? "thinking" : mood;/);
  assert.match(widget, /flashMood\("answered"\)/);
  assert.match(widget, /flashMood\("error"\)/);

  const mascot = read("apps/web/app/components/prometeo/PrometeoMascot.tsx");
  assert.match(mascot, /dynamic\(\(\) => import\("\.\/PrometeoMascot3D"\), \{ ssr: false/);
  assert.match(mascot, /avatar-256\.png/);
  assert.match(mascot, /getDerivedStateFromError/);
});

test("la escena libera sus recursos de GPU al desmontarse", () => {
  const scene = read("apps/web/lib/prometeo-mascot-scene.ts");
  assert.match(scene, /dispose\(\) \{/);
  assert.match(scene, /renderer\.forceContextLoss\(\)/);
  assert.match(scene, /cancelAnimationFrame\(this\.frame\)/);
  assert.match(scene, /removeEventListener\("pointermove", this\.onWindowPointerMove\)/);
});
