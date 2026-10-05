import * as THREE from "three";
import {
  BRAND,
  dragToYaw,
  drawFace,
  headTargetFromPointer,
  isClick,
  normalizePointer,
  resolveExpression,
  type FaceContext,
  type MascotExpression,
  type MascotMood,
} from "./prometeo-mascot";

/**
 * Escena 3D de la mascota de Prometeo (robot con llama), construida con three.js directo:
 * cabeza blanca con visor y rostro dibujado, audífonos, cuerpo con logo, brazos y una llama animada con shader.
 * Interacción: la cabeza sigue el cursor, saluda al pasar el cursor, reacciona al estado del asistente,
 * se gira arrastrando y un clic dispara `onActivate`.
 */

const FLAME_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  varying vec2 vUv;
  varying vec3 vNormalView;
  void main() {
    vUv = uv;
    vec3 p = position;
    float h = uv.y;
    float sway = sin(uTime * 3.0 + h * 5.0 + uSeed) * 0.10 * h * h
               + sin(uTime * 5.3 + h * 9.0 + uSeed * 1.7) * 0.04 * h;
    p.x += sway;
    p.z += cos(uTime * 2.6 + h * 4.0 + uSeed) * 0.08 * h * h;
    p.xz *= 1.0 + sin(uTime * 7.0 + uSeed + h * 6.0) * 0.05;
    p.y *= 1.0 + sin(uTime * 4.0 + uSeed) * 0.04;
    vNormalView = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const FLAME_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uBoost;
  varying vec2 vUv;
  varying vec3 vNormalView;
  void main() {
    float h = vUv.y;
    vec3 core = vec3(1.0, 0.96, 0.72);
    vec3 mid = vec3(1.0, 0.55, 0.05);
    vec3 tip = vec3(0.95, 0.22, 0.02);
    vec3 col = mix(core, mid, smoothstep(0.0, 0.45, h));
    col = mix(col, tip, smoothstep(0.45, 1.0, h));
    float rim = pow(1.0 - abs(vNormalView.z), 1.4);
    float alpha = (1.0 - smoothstep(0.55, 1.0, h)) * (0.62 + 0.38 * (1.0 - rim));
    alpha *= 0.92 + 0.08 * sin(uTime * 22.0 + h * 11.0);
    gl_FragColor = vec4(col * (1.0 + uBoost), alpha);
  }
`;

type FlameSpec = { seed: number; height: number; width: number; tilt: number; position: [number, number, number] };

export type MascotSceneOptions = { onActivate?: () => void; onContextLost?: () => void };

export class MascotScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  private readonly root = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly rightArm = new THREE.Group();
  private readonly leftArm = new THREE.Group();
  private readonly flameLight = new THREE.PointLight("#ff7a1a", 6, 6, 2);
  private readonly flames: THREE.ShaderMaterial[] = [];
  private readonly disposables: Array<{ dispose(): void }> = [];
  private readonly faceCanvas = document.createElement("canvas");
  private readonly faceTexture: THREE.CanvasTexture;
  private readonly raycaster = new THREE.Raycaster();
  private readonly clock = new THREE.Clock();

  private mood: MascotMood = "idle";
  private hover = false;
  private reaction: MascotExpression | null = null;
  private reactionUntil = 0;
  private blink = false;
  private nextBlinkAt = 2.5;
  private drawnExpression: MascotExpression | null = null;
  private drawnBlink = false;
  private look = { x: 0, y: 0 };
  private yaw = 0;
  private drag: { x: number; y: number; yaw: number; pointerId: number } | null = null;
  private frame = 0;
  private disposed = false;
  private flameBoost = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly options: MascotSceneOptions = {},
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.camera.position.set(0, 0.62, 7.7);
    this.camera.lookAt(0, 0.62, 0);

    this.faceCanvas.width = 512;
    this.faceCanvas.height = 256;
    this.faceTexture = new THREE.CanvasTexture(this.faceCanvas);
    this.faceTexture.colorSpace = THREE.SRGBColorSpace;
    this.faceTexture.anisotropy = 4;
    this.disposables.push(this.faceTexture);

    this.buildLights();
    this.buildRobot();
    this.scene.add(this.root);
    this.redrawFace("feliz", false);

    window.addEventListener("pointermove", this.onWindowPointerMove, { passive: true });
    canvas.addEventListener("pointermove", this.onCanvasPointerMove);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerCancel);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
    canvas.addEventListener("webglcontextlost", this.onContextLost);

    this.frame = requestAnimationFrame(this.loop);
  }

  setMood(mood: MascotMood) {
    this.mood = mood;
  }

  resize(size: number) {
    this.renderer.setSize(size, size, false);
    this.camera.aspect = 1;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    window.removeEventListener("pointermove", this.onWindowPointerMove);
    this.canvas.removeEventListener("pointermove", this.onCanvasPointerMove);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerCancel);
    this.canvas.removeEventListener("pointerleave", this.onPointerLeave);
    this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
    this.canvas.style.cursor = "";
    this.disposables.forEach((d) => d.dispose());
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  // ── Construcción ───────────────────────────────────────────────────────────

  private track<T extends { dispose(): void }>(resource: T): T {
    this.disposables.push(resource);
    return resource;
  }

  private buildLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const key = new THREE.DirectionalLight(0xffffff, 1.7);
    key.position.set(3, 4, 5);
    const rim = new THREE.DirectionalLight(BRAND.cyan, 0.9);
    rim.position.set(-4, 1.5, -2);
    this.scene.add(key, rim);
  }

  private buildRobot() {
    const shell = this.track(
      new THREE.MeshPhysicalMaterial({ color: "#f3f6fb", roughness: 0.28, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.15 }),
    );
    const dark = this.track(new THREE.MeshStandardMaterial({ color: "#2a3140", roughness: 0.5, metalness: 0.6 }));
    const cyan = this.track(
      new THREE.MeshStandardMaterial({ color: BRAND.cyan, emissive: BRAND.cyan, emissiveIntensity: 2.2, toneMapped: false }),
    );
    const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material) =>
      new THREE.Mesh(this.track(geometry), material);

    // Cabeza: cascarón + visor (segmento de esfera con el rostro) + audífonos + llama.
    this.head.position.set(0, 0.15, 0);
    const skull = new THREE.Group();
    skull.scale.set(1, 0.93, 0.98);
    skull.add(mesh(new THREE.SphereGeometry(1, 64, 48), shell));
    const visorMaterial = this.track(
      new THREE.MeshStandardMaterial({
        map: this.faceTexture,
        emissiveMap: this.faceTexture,
        emissive: new THREE.Color("#ffffff"),
        emissiveIntensity: 1.1,
        roughness: 0.12,
        metalness: 0.3,
        toneMapped: false,
      }),
    );
    skull.add(mesh(new THREE.SphereGeometry(1.018, 64, 40, Math.PI / 2 - 0.98, 1.96, Math.PI / 2 - 0.56, 1.12), visorMaterial));
    this.head.add(skull);

    for (const side of [-1, 1]) {
      const ear = new THREE.Group();
      ear.position.set(side * 1.02, -0.02, 0);
      ear.rotation.z = Math.PI / 2;
      ear.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.24, 40), shell));
      const ring = mesh(new THREE.TorusGeometry(0.2, 0.028, 12, 40), cyan);
      ring.position.y = side * 0.125;
      ring.rotation.x = (side * Math.PI) / 2;
      ear.add(ring);
      this.head.add(ear);
    }

    const flameGroup = new THREE.Group();
    flameGroup.position.set(0, 0.88, 0);
    // Varias lenguas de distinta altura, abiertas en abanico (la central es la más alta y brillante).
    const specs: FlameSpec[] = [
      { seed: 0, height: 1.0, width: 0.8, tilt: 0, position: [0, 0, 0] },
      { seed: 2.1, height: 0.78, width: 0.64, tilt: -0.42, position: [-0.2, -0.02, 0.04] },
      { seed: 4.3, height: 0.7, width: 0.62, tilt: 0.46, position: [0.22, -0.02, -0.03] },
      { seed: 6.2, height: 0.5, width: 0.46, tilt: -0.85, position: [-0.34, -0.05, 0.0] },
      { seed: 8.4, height: 0.46, width: 0.44, tilt: 0.9, position: [0.36, -0.05, 0.0] },
    ];
    const profile = [
      [0.0, 0.0], [0.3, 0.04], [0.45, 0.24], [0.43, 0.5], [0.32, 0.8], [0.17, 1.1], [0.06, 1.36], [0.0, 1.52],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const flameGeometry = this.track(new THREE.LatheGeometry(profile, 36));
    for (const spec of specs) {
      const material = this.track(
        new THREE.ShaderMaterial({
          vertexShader: FLAME_VERTEX,
          fragmentShader: FLAME_FRAGMENT,
          uniforms: { uTime: { value: 0 }, uSeed: { value: spec.seed }, uBoost: { value: 0 } },
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          toneMapped: false,
        }),
      );
      this.flames.push(material);
      const flame = new THREE.Mesh(flameGeometry, material);
      flame.position.set(...spec.position);
      flame.scale.set(spec.width, spec.height, spec.width);
      flame.rotation.z = spec.tilt;
      flameGroup.add(flame);
    }
    this.flameLight.position.set(0, 0.6, 0.6);
    flameGroup.add(this.flameLight);
    this.head.add(flameGroup);

    // Cuerpo: cuello, torso con logo y brazos articulados en el hombro.
    this.body.position.set(0, -1.32, 0);
    const neck = mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.3, 24), dark);
    neck.position.y = 0.5;
    const torso = mesh(new THREE.CapsuleGeometry(0.6, 0.45, 10, 28), shell);
    torso.scale.set(1, 1, 0.78);
    const logo = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(0.36, 0.36)),
      this.track(new THREE.MeshBasicMaterial({ map: this.buildLogoTexture(), transparent: true, toneMapped: false })),
    );
    logo.position.set(0, 0.05, 0.47);
    this.body.add(neck, torso, logo);

    for (const [arm, x] of [[this.rightArm, 0.78], [this.leftArm, -0.78]] as const) {
      arm.position.set(x, 0.22, 0);
      arm.add(mesh(new THREE.SphereGeometry(0.2, 20, 16), dark));
      const limb = mesh(new THREE.CapsuleGeometry(0.13, 0.36, 8, 16), shell);
      limb.position.y = -0.34;
      arm.add(limb);
      this.body.add(arm);
    }

    this.root.add(this.head, this.body);
  }

  private buildLogoTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.strokeStyle = BRAND.cyan;
      ctx.fillStyle = BRAND.cyan;
      ctx.lineWidth = 7;
      ctx.shadowColor = BRAND.cyan;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(24, 20);
      ctx.lineTo(104, 20);
      ctx.lineTo(64, 104);
      ctx.closePath();
      ctx.stroke();
      ctx.font = "bold 52px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("P", 64, 70);
    }
    const texture = this.track(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // ── Rostro ─────────────────────────────────────────────────────────────────

  private redrawFace(expression: MascotExpression, blink: boolean) {
    if (this.drawnExpression === expression && this.drawnBlink === blink) return;
    const ctx = this.faceCanvas.getContext("2d");
    if (!ctx) return;
    drawFace(ctx as unknown as FaceContext, expression, blink);
    this.faceTexture.needsUpdate = true;
    this.drawnExpression = expression;
    this.drawnBlink = blink;
  }

  private react(expression: MascotExpression, seconds: number) {
    this.reaction = expression;
    this.reactionUntil = this.clock.elapsedTime + seconds;
  }

  // ── Interacción ────────────────────────────────────────────────────────────

  private ndc(event: PointerEvent): THREE.Vector2 {
    const rect = this.canvas.getBoundingClientRect();
    return new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  }

  private hit(event: PointerEvent): boolean {
    this.raycaster.setFromCamera(this.ndc(event), this.camera);
    return this.raycaster.intersectObject(this.root, true).length > 0;
  }

  private setHover(next: boolean) {
    if (this.hover === next) return;
    this.hover = next;
    this.canvas.style.cursor = next ? "pointer" : "";
  }

  private readonly onWindowPointerMove = (event: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    this.look = normalizePointer({ x: event.clientX, y: event.clientY }, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  };

  private readonly onCanvasPointerMove = (event: PointerEvent) => {
    if (this.drag) {
      this.yaw = dragToYaw(this.drag.yaw, event.clientX - this.drag.x);
      return;
    }
    this.setHover(this.hit(event));
  };

  private readonly onPointerDown = (event: PointerEvent) => {
    if (!this.hit(event)) return;
    this.canvas.setPointerCapture?.(event.pointerId);
    this.drag = { x: event.clientX, y: event.clientY, yaw: this.yaw, pointerId: event.pointerId };
  };

  private readonly onPointerUp = (event: PointerEvent) => {
    const start = this.drag;
    this.drag = null;
    if (start) this.canvas.releasePointerCapture?.(start.pointerId);
    if (start && isClick(start, { x: event.clientX, y: event.clientY })) {
      this.react("sorprendido", 0.7);
      this.options.onActivate?.();
    }
  };

  private readonly onPointerCancel = () => {
    this.drag = null;
  };

  /** El navegador puede descartar el contexto WebGL (memoria, GPU): se avisa para caer a la imagen de marca. */
  private readonly onContextLost = (event: Event) => {
    event.preventDefault();
    if (!this.disposed) this.options.onContextLost?.();
  };

  private readonly onPointerLeave = () => {
    if (!this.drag) this.setHover(false);
  };

  // ── Bucle ──────────────────────────────────────────────────────────────────

  private readonly loop = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);
    const delta = Math.min(this.clock.getDelta(), 0.1);
    const t = this.clock.elapsedTime;
    const damp = 1 - Math.pow(0.001, delta); // suavizado independiente de los fps
    const lerp = THREE.MathUtils.lerp;

    // Expresión: reacción momentánea > saludo al pasar el cursor > estado de ánimo; parpadeo natural.
    if (this.reaction && t > this.reactionUntil) this.reaction = null;
    if (t > this.nextBlinkAt) {
      this.blink = !this.blink;
      this.nextBlinkAt = t + (this.blink ? 0.13 : 2.5 + Math.random() * 2.5);
    }
    const expression = resolveExpression(this.mood, this.hover && !this.reaction ? "feliz" : this.reaction);
    this.redrawFace(expression, this.blink);

    // Giro por arrastre: al soltar vuelve despacio al frente. La mascota flota y respira.
    if (!this.drag) this.yaw = lerp(this.yaw, 0, 1 - Math.pow(0.05, delta));
    this.root.rotation.y = this.yaw;
    this.root.position.y = Math.sin(t * 1.6) * 0.05;

    const target = headTargetFromPointer(this.look);
    this.head.rotation.y = lerp(this.head.rotation.y, target.yaw, damp * 0.6);
    this.head.rotation.x = lerp(this.head.rotation.x, target.pitch, damp * 0.6);
    this.head.rotation.z = Math.sin(t * 1.1) * 0.015;
    this.body.rotation.y = lerp(this.body.rotation.y, target.yaw * 0.3, damp * 0.4);
    this.body.scale.y = 1 + Math.sin(t * 1.6) * 0.012;

    // Brazos: saluda con el derecho al pasar el cursor; "guiando" señala con el izquierdo.
    const wave = this.hover ? 2.4 + Math.sin(t * 9) * 0.3 : 0.12 + Math.sin(t * 1.6) * 0.02;
    this.rightArm.rotation.z = lerp(this.rightArm.rotation.z, wave, damp * 0.9);
    const point = expression === "guiando" ? -1.15 : -0.12 - Math.sin(t * 1.6) * 0.02;
    this.leftArm.rotation.z = lerp(this.leftArm.rotation.z, point, damp * 0.7);

    // Llama: más viva al pensar o al pasar el cursor, apagada si hay error.
    const boost = this.mood === "thinking" ? 0.35 : this.mood === "error" ? -0.2 : this.hover ? 0.2 : 0;
    this.flameBoost = lerp(this.flameBoost, boost, 0.1);
    for (const material of this.flames) {
      material.uniforms.uTime.value = t;
      material.uniforms.uBoost.value = this.flameBoost;
    }
    this.flameLight.intensity = 6 + Math.sin(t * 17) * 0.8 + Math.sin(t * 9.3) * 0.6 + (this.hover ? 2 : 0);

    this.renderer.render(this.scene, this.camera);
  };
}
