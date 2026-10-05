/**
 * Lógica pura de la mascota 3D de Prometeo (robot con llama). Sin three.js ni DOM, para poder probarla en Node.
 * Las expresiones salen del álbum de marca: feliz, pensando, guiando, sorprendido y confirmado.
 */

export type MascotExpression = "feliz" | "pensando" | "guiando" | "sorprendido" | "confirmado";

/** Estado del asistente que gobierna la expresión de fondo. */
export type MascotMood = "idle" | "thinking" | "answered" | "error" | "success";

export const BRAND = {
  cyan: "#29d3ff",
  navy: "#0d1b2a",
  orange: "#ff6a00",
  white: "#ffffff",
  grey: "#a7b0bf",
} as const;

export function expressionForMood(mood: MascotMood): MascotExpression {
  switch (mood) {
    case "thinking":
      return "pensando";
    case "answered":
      return "guiando";
    case "error":
      return "sorprendido";
    case "success":
      return "confirmado";
    default:
      return "feliz";
  }
}

/** Una reacción momentánea (hover, clic) gana a la expresión de fondo. */
export function resolveExpression(mood: MascotMood, reaction: MascotExpression | null): MascotExpression {
  return reaction ?? expressionForMood(mood);
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Posición del cursor respecto al centro de la mascota, normalizada a [-1, 1] en cada eje. `reach` es la
 * distancia en píxeles a partir de la cual la cabeza ya mira "al máximo" (el cursor lejos del lienzo también cuenta).
 */
export function normalizePointer(
  pointer: { x: number; y: number },
  center: { x: number; y: number },
  reach = 420,
): { x: number; y: number } {
  return {
    x: clamp((pointer.x - center.x) / reach, -1, 1),
    y: clamp((pointer.y - center.y) / reach, -1, 1),
  };
}

/** Giro objetivo de la cabeza (radianes) para un cursor normalizado: limitado para que nunca se "rompa el cuello". */
export function headTargetFromPointer(look: { x: number; y: number }): { yaw: number; pitch: number } {
  return {
    yaw: clamp(look.x, -1, 1) * 0.55,
    pitch: clamp(look.y, -1, 1) * 0.3,
  };
}

/** Un clic es un gesto corto: si el puntero se movió más de `slop` píxeles fue un arrastre para girar. */
export function isClick(down: { x: number; y: number }, up: { x: number; y: number }, slop = 6): boolean {
  return Math.hypot(up.x - down.x, up.y - down.y) <= slop;
}

/** Cuánto gira el modelo con un arrastre horizontal (px → radianes), con tope de media vuelta a cada lado. */
export function dragToYaw(startYaw: number, deltaX: number): number {
  return clamp(startYaw + deltaX * 0.012, -Math.PI * 0.9, Math.PI * 0.9);
}

/** 3D solo si hay WebGL y el usuario no pidió menos movimiento; en otro caso se usa la imagen de marca. */
export function shouldRender3D(env: { webgl: boolean; reducedMotion: boolean }): boolean {
  return env.webgl && !env.reducedMotion;
}

/** Subconjunto de CanvasRenderingContext2D que usa el dibujo del rostro (permite probarlo con un doble). */
export type FaceContext = {
  canvas: { width: number; height: number };
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  lineCap: CanvasLineCap;
  shadowColor: string;
  shadowBlur: number;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw?: boolean): void;
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number): void;
  stroke(): void;
  fill(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
};

/**
 * Dibuja el rostro del visor: fondo oscuro y ojos y boca cian con brillo. `blink` cierra los ojos un instante.
 * Devuelve la lista de formas dibujadas (útil para pruebas).
 */
export function drawFace(ctx: FaceContext, expression: MascotExpression, blink = false): string[] {
  const { width: w, height: h } = ctx.canvas;
  const shapes: string[] = [];
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#04070d";
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = BRAND.cyan;
  ctx.fillStyle = BRAND.cyan;
  ctx.shadowColor = BRAND.cyan;
  ctx.shadowBlur = 26;
  ctx.lineCap = "round";
  ctx.lineWidth = Math.round(h * 0.07);

  const eyeY = h * 0.42;
  const leftX = w * 0.32;
  const rightX = w * 0.68;
  const eyeR = h * 0.13;

  const happyEye = (x: number) => {
    ctx.beginPath();
    ctx.arc(x, eyeY + eyeR * 0.5, eyeR, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    shapes.push("eye:arc");
  };
  const roundEye = (x: number, r = eyeR * 0.85) => {
    ctx.beginPath();
    ctx.arc(x, eyeY, r, 0, Math.PI * 2);
    ctx.stroke();
    shapes.push("eye:ring");
  };
  const dotEye = (x: number, r = eyeR * 0.75) => {
    ctx.beginPath();
    ctx.ellipse(x, eyeY, r, blink ? r * 0.12 : r * 1.05, 0, 0, Math.PI * 2);
    ctx.fill();
    shapes.push(blink ? "eye:closed" : "eye:dot");
  };
  const smile = (width: number, depth: number) => {
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.66, width, depth, 0, Math.PI * 0.12, Math.PI * 0.88);
    ctx.stroke();
    shapes.push("mouth:smile");
  };

  switch (expression) {
    case "pensando":
      // un ojo entrecerrado y otro abierto, sonrisa pequeña y ladeada
      ctx.beginPath();
      ctx.moveTo(leftX - eyeR, eyeY + eyeR * 0.2);
      ctx.lineTo(leftX + eyeR, eyeY - eyeR * 0.2);
      ctx.stroke();
      shapes.push("eye:squint");
      dotEye(rightX, eyeR * 0.8);
      ctx.beginPath();
      ctx.moveTo(w * 0.44, h * 0.7);
      ctx.lineTo(w * 0.58, h * 0.68);
      ctx.stroke();
      shapes.push("mouth:flat");
      break;
    case "sorprendido":
      roundEye(leftX);
      roundEye(rightX);
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.7, h * 0.08, 0, Math.PI * 2);
      ctx.stroke();
      shapes.push("mouth:o");
      break;
    case "guiando":
      happyEye(leftX);
      dotEye(rightX, eyeR * 0.7);
      smile(w * 0.17, h * 0.13);
      break;
    case "confirmado":
      happyEye(leftX);
      happyEye(rightX);
      smile(w * 0.2, h * 0.16);
      // marca de verificación en la esquina del visor (como en el álbum de marca)
      ctx.beginPath();
      ctx.moveTo(w * 0.86, h * 0.2);
      ctx.lineTo(w * 0.895, h * 0.26);
      ctx.lineTo(w * 0.95, h * 0.14);
      ctx.stroke();
      shapes.push("badge:check");
      break;
    default:
      // feliz: con parpadeo los arcos se vuelven puntos aplanados
      if (blink) {
        dotEye(leftX);
        dotEye(rightX);
      } else {
        happyEye(leftX);
        happyEye(rightX);
      }
      smile(w * 0.17, h * 0.12);
  }
  ctx.shadowBlur = 0;
  return shapes;
}
