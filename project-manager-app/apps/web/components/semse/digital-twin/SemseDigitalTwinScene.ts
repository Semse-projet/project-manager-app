import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createDigitalTwinLayout, createDomainLayout } from "@/lib/digital-twin/layout.ts";
import { getFlowPlaybackFrame } from "@/lib/digital-twin/flows.ts";
import {
  DOMAIN_BY_ID,
  type DigitalTwinFlow,
  type DigitalTwinNode,
  type DigitalTwinPerspective,
  type DigitalTwinPlayback,
  type DigitalTwinPosition,
  type DigitalTwinSnapshot,
} from "@/lib/digital-twin/view-model.ts";

interface SceneCallbacks {
  onSelect: (nodeId: string | null) => void;
  onContextLost: () => void;
}

interface VisualState {
  selectedId: string | null;
  perspective: DigitalTwinPerspective;
  activeFlowId: string;
  emphasisKey: string;
}

type Disposable = { dispose: () => void };

const INACTIVE_EDGE = new THREE.Color("#243247");
const ACTIVE_EDGE = new THREE.Color("#D4A853");
const SELECTED_EDGE = new THREE.Color("#2EC4B6");
const CRITICALITY_COLORS = {
  critical: new THREE.Color("#F87171"),
  high: new THREE.Color("#FBBF24"),
  medium: new THREE.Color("#60A5FA"),
  low: new THREE.Color("#64748B"),
};

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function curvePoint(
  source: DigitalTwinPosition,
  target: DigitalTwinPosition,
  progress: number,
): THREE.Vector3 {
  const a = new THREE.Vector3(source.x, source.y, source.z);
  const b = new THREE.Vector3(target.x, target.y, target.z);
  const control = a.clone().lerp(b, 0.5);
  control.y += Math.max(0.8, a.distanceTo(b) * 0.12);
  const inverse = 1 - progress;
  return a.multiplyScalar(inverse * inverse)
    .add(control.multiplyScalar(2 * inverse * progress))
    .add(b.multiplyScalar(progress * progress));
}

export class SemseDigitalTwinScene {
  private readonly container: HTMLDivElement;
  private readonly snapshot: DigitalTwinSnapshot;
  private readonly callbacks: SceneCallbacks;
  private readonly disposables: Disposable[] = [];
  private readonly labels = new Map<string, HTMLDivElement>();
  private readonly positions: Record<string, DigitalTwinPosition>;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 180);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly resizeObserver: ResizeObserver;
  private readonly nodeMesh: THREE.InstancedMesh;
  private readonly edgeMesh: THREE.LineSegments;
  private readonly pulse: THREE.Mesh;
  private readonly selectionHalo: THREE.Mesh;
  private readonly edgeIdsByVertex: string[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly scratch = new THREE.Object3D();
  private visualState: VisualState;
  private playback: DigitalTwinPlayback | null = null;
  private reducedMotion = false;
  private frame = 0;
  private renderCount = 0;
  private disposed = false;
  private contextLost = false;
  private cameraFitScale = 1;
  private pointerDown = { x: 0, y: 0 };

  constructor(
    container: HTMLDivElement,
    snapshot: DigitalTwinSnapshot,
    visualState: VisualState,
    callbacks: SceneCallbacks,
  ) {
    this.container = container;
    this.snapshot = snapshot;
    this.visualState = visualState;
    this.callbacks = callbacks;
    this.positions = createDigitalTwinLayout(snapshot.nodes);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    const canvas = this.renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "application");
    canvas.setAttribute("aria-label", "Grafo 3D. Usa flechas para recorrer módulos, Enter para seleccionar y Escape para limpiar.");
    canvas.dataset.nodeCount = String(snapshot.nodes.length);
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.outline = "2px solid transparent";
    canvas.style.outlineOffset = "-2px";
    container.appendChild(canvas);

    this.scene.background = new THREE.Color("#060B14");
    this.scene.fog = new THREE.Fog("#060B14", 48, 105);
    this.camera.position.set(31, 30, 39);
    this.camera.lookAt(0, 2, 0);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, 2, 0);
    this.controls.enableDamping = false;
    this.controls.minDistance = 16;
    this.controls.maxDistance = 85;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.addEventListener("change", this.requestRender);

    this.addEnvironment();
    this.nodeMesh = this.addNodes();
    this.edgeMesh = this.addEdges();
    this.pulse = this.addPulse();
    this.selectionHalo = this.addSelectionHalo();
    this.setVisualState(visualState);

    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("keydown", this.onKeyDown);
    canvas.addEventListener("focus", this.onFocus);
    canvas.addEventListener("blur", this.onBlur);
    canvas.addEventListener("webglcontextlost", this.onContextLost);
    canvas.addEventListener("webglcontextrestored", this.onContextRestored);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(container);
    this.resize();
    container.dataset.sceneReady = "true";
    this.requestRender();
  }

  private track<T extends Disposable>(resource: T): T {
    this.disposables.push(resource);
    return resource;
  }

  private addEnvironment() {
    const hemisphere = new THREE.HemisphereLight("#BAE6FD", "#08111F", 1.5);
    const key = new THREE.DirectionalLight("#FFFFFF", 2.1);
    key.position.set(14, 28, 18);
    this.scene.add(hemisphere, key);

    const grid = new THREE.GridHelper(82, 41, "#25415A", "#142234");
    this.track(grid.geometry);
    grid.position.y = -0.12;
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMaterials.forEach((material) => {
      material.transparent = true;
      material.opacity = 0.32;
      this.track(material);
    });
    this.scene.add(grid);

    const domainLayout = createDomainLayout();
    for (const domainLayoutItem of domainLayout) {
      const domain = DOMAIN_BY_ID[domainLayoutItem.id];
      const diskGeometry = this.track(new THREE.CircleGeometry(5.25, 48));
      const diskMaterial = this.track(new THREE.MeshBasicMaterial({
        color: domain.color, transparent: true, opacity: 0.035, depthWrite: false,
      }));
      const disk = new THREE.Mesh(diskGeometry, diskMaterial);
      disk.rotation.x = -Math.PI / 2;
      disk.position.set(domainLayoutItem.x, -0.04, domainLayoutItem.z);
      this.scene.add(disk);

      const ringGeometry = this.track(new THREE.TorusGeometry(5.25, 0.026, 4, 64));
      const ringMaterial = this.track(new THREE.MeshBasicMaterial({
        color: domain.color, transparent: true, opacity: 0.52,
      }));
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(domainLayoutItem.x, 0, domainLayoutItem.z);
      this.scene.add(ring);

      const label = document.createElement("div");
      const count = this.snapshot.nodes.filter((node) => node.canonicalDomain === domain.id).length;
      label.textContent = `${domain.shortLabel} · ${count}`;
      label.setAttribute("aria-hidden", "true");
      label.dataset.domainLabel = domain.id;
      Object.assign(label.style, {
        position: "absolute", top: "0", left: "0", pointerEvents: "none",
        padding: "4px 8px", borderRadius: "999px", whiteSpace: "nowrap",
        color: domain.color, background: "rgba(6,11,20,.82)", border: `1px solid ${domain.color}44`,
        font: "600 10px/1.2 Inter, system-ui, sans-serif", letterSpacing: ".06em",
        textTransform: "uppercase", backdropFilter: "blur(8px)",
      });
      this.container.appendChild(label);
      this.labels.set(domain.id, label);
    }

    const random = seededRandom(20261115);
    const starPositions = new Float32Array(150 * 3);
    for (let index = 0; index < 150; index += 1) {
      starPositions[index * 3] = (random() - 0.5) * 90;
      starPositions[index * 3 + 1] = 8 + random() * 28;
      starPositions[index * 3 + 2] = (random() - 0.5) * 90;
    }
    const starGeometry = this.track(new THREE.BufferGeometry());
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = this.track(new THREE.PointsMaterial({
      color: "#67E8F9", size: 0.06, transparent: true, opacity: 0.35, depthWrite: false,
    }));
    this.scene.add(new THREE.Points(starGeometry, starMaterial));
  }

  private addNodes(): THREE.InstancedMesh {
    const geometry = this.track(new THREE.IcosahedronGeometry(0.62, 1));
    const material = this.track(new THREE.MeshBasicMaterial({
      toneMapped: false,
    }));
    const mesh = new THREE.InstancedMesh(geometry, material, this.snapshot.nodes.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.userData.nodeIds = this.snapshot.nodes.map((node) => node.id);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    return mesh;
  }

  private addEdges(): THREE.LineSegments {
    const vertices: number[] = [];
    for (const edge of this.snapshot.edges) {
      const source = this.positions[edge.source];
      const target = this.positions[edge.target];
      if (!source || !target) continue;
      const steps = 7;
      for (let step = 0; step < steps; step += 1) {
        const from = curvePoint(source, target, step / steps);
        const to = curvePoint(source, target, (step + 1) / steps);
        vertices.push(from.x, from.y, from.z, to.x, to.y, to.z);
        this.edgeIdsByVertex.push(edge.id, edge.id);
      }
    }
    const geometry = this.track(new THREE.BufferGeometry());
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(vertices.length), 3));
    const material = this.track(new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.68, depthWrite: false,
    }));
    const mesh = new THREE.LineSegments(geometry, material);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    return mesh;
  }

  private addPulse(): THREE.Mesh {
    const geometry = this.track(new THREE.IcosahedronGeometry(0.2, 1));
    const material = this.track(new THREE.MeshBasicMaterial({ color: "#FDE68A" }));
    const pulse = new THREE.Mesh(geometry, material);
    const light = new THREE.PointLight("#D4A853", 3, 5);
    pulse.add(light);
    pulse.visible = false;
    this.scene.add(pulse);
    return pulse;
  }

  private addSelectionHalo(): THREE.Mesh {
    const geometry = this.track(new THREE.TorusGeometry(0.78, 0.026, 5, 40));
    const material = this.track(new THREE.MeshBasicMaterial({
      color: "#E8EDF3", transparent: true, opacity: 0.85,
    }));
    const halo = new THREE.Mesh(geometry, material);
    halo.rotation.x = Math.PI / 2;
    halo.visible = false;
    this.scene.add(halo);
    return halo;
  }

  setVisualState(state: VisualState) {
    this.visualState = state;
    const emphasized = new Set(state.emphasisKey.split(",").filter(Boolean));
    const activeFlow = this.getActiveFlow();
    const flowNodes = new Set(activeFlow?.nodeIds ?? []);
    const selectedPosition = state.selectedId ? this.positions[state.selectedId] : null;

    this.snapshot.nodes.forEach((node, index) => {
      const position = this.positions[node.id];
      const isSelected = node.id === state.selectedId;
      const isEmphasized = emphasized.size === 0 || emphasized.has(node.id);
      let scale = isSelected ? 1.55 : isEmphasized ? 1 : 0.45;
      if (state.perspective === "flows" && activeFlow && !flowNodes.has(node.id)) scale *= 0.62;
      this.scratch.position.set(position.x, position.y, position.z);
      this.scratch.scale.setScalar(scale);
      this.scratch.updateMatrix();
      this.nodeMesh.setMatrixAt(index, this.scratch.matrix);

      let color = new THREE.Color(DOMAIN_BY_ID[node.canonicalDomain].color);
      if (state.perspective === "health") color = CRITICALITY_COLORS[node.criticality];
      if (state.perspective === "flows" && activeFlow && !flowNodes.has(node.id)) {
        color = new THREE.Color("#334155");
      }
      if (!isEmphasized) color.multiplyScalar(0.28);
      this.nodeMesh.setColorAt(index, color);
    });
    this.nodeMesh.instanceMatrix.needsUpdate = true;
    if (this.nodeMesh.instanceColor) this.nodeMesh.instanceColor.needsUpdate = true;

    this.selectionHalo.visible = Boolean(selectedPosition);
    if (selectedPosition) {
      this.selectionHalo.position.set(selectedPosition.x, selectedPosition.y - 0.62, selectedPosition.z);
    }
    this.updateEdgeColors();
    this.container.dataset.selectedNode = state.selectedId ?? "";
    this.requestRender();
  }

  private getActiveFlow(): DigitalTwinFlow | undefined {
    return this.snapshot.flows.find((flow) => flow.id === this.visualState.activeFlowId);
  }

  private updateEdgeColors(currentSegment = -1) {
    const activeFlow = this.getActiveFlow();
    const activeEdges = new Set(activeFlow?.edgeIds ?? []);
    const selectedEdges = new Set<string>();
    if (this.visualState.selectedId) {
      for (const edge of this.snapshot.edges) {
        if (edge.source === this.visualState.selectedId || edge.target === this.visualState.selectedId) {
          selectedEdges.add(edge.id);
        }
      }
    }
    const attribute = this.edgeMesh.geometry.getAttribute("color") as THREE.BufferAttribute;
    for (let vertex = 0; vertex < attribute.count; vertex += 1) {
      const edgeId = this.edgeIdsByVertex[vertex];
      let color = INACTIVE_EDGE;
      if (selectedEdges.has(edgeId)) color = SELECTED_EDGE;
      if (this.visualState.perspective === "flows" && activeEdges.has(edgeId)) {
        const edgeIndex = activeFlow?.edgeIds.indexOf(edgeId) ?? -1;
        color = currentSegment < 0 || edgeIndex <= currentSegment ? ACTIVE_EDGE : INACTIVE_EDGE;
      }
      attribute.setXYZ(vertex, color.r, color.g, color.b);
    }
    attribute.needsUpdate = true;
  }

  setPlayback(playback: DigitalTwinPlayback | null, reducedMotion: boolean) {
    this.playback = playback;
    this.reducedMotion = reducedMotion;
    this.pulse.visible = Boolean(playback) && !reducedMotion;
    this.container.dataset.playbackPhase = playback ? "playing" : "idle";
    this.updateEdgeColors();
    this.requestRender();
  }

  resetCamera() {
    const target = new THREE.Vector3(0, 2, 0);
    this.camera.position.set(31, 30, 39)
      .sub(target)
      .multiplyScalar(this.cameraFitScale)
      .add(target);
    this.controls.target.copy(target);
    this.controls.update();
    this.requestRender();
  }

  private onPointerDown = (event: PointerEvent) => {
    this.pointerDown = { x: event.clientX, y: event.clientY };
  };

  private onPointerUp = (event: PointerEvent) => {
    if (Math.hypot(event.clientX - this.pointerDown.x, event.clientY - this.pointerDown.y) > 6) return;
    const nodeId = this.pick(event);
    if (nodeId) this.callbacks.onSelect(nodeId);
  };

  private onPointerMove = (event: PointerEvent) => {
    this.renderer.domElement.style.cursor = this.pick(event) ? "pointer" : "grab";
  };

  private pick(event: PointerEvent): string | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObject(this.nodeMesh, false)[0];
    if (!hit || hit.instanceId === undefined) return null;
    return this.snapshot.nodes[hit.instanceId]?.id ?? null;
  }

  private onFocus = () => {
    this.renderer.domElement.style.outlineColor = "#67E8F9";
  };

  private onBlur = () => {
    this.renderer.domElement.style.outlineColor = "transparent";
  };

  private onKeyDown = (event: KeyboardEvent) => {
    const nodes = this.snapshot.nodes;
    const currentIndex = nodes.findIndex((node) => node.id === this.visualState.selectedId);
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (currentIndex + 1 + nodes.length) % nodes.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (currentIndex - 1 + nodes.length) % nodes.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = nodes.length - 1;
    if (nextIndex !== null) {
      event.preventDefault();
      this.callbacks.onSelect(nodes[nextIndex].id);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      this.callbacks.onSelect(null);
    }
    if ((event.key === "Enter" || event.key === " ") && currentIndex >= 0) {
      event.preventDefault();
      this.callbacks.onSelect(nodes[currentIndex].id);
    }
  };

  private onContextLost = (event: Event) => {
    event.preventDefault();
    if (this.disposed) return;
    this.contextLost = true;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.callbacks.onContextLost();
  };

  private onContextRestored = () => {
    if (this.disposed) return;
    this.contextLost = false;
    this.requestRender();
  };

  private resize = () => {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    const nextFitScale = Math.max(1, 1.2 / this.camera.aspect);
    if (Math.abs(nextFitScale - this.cameraFitScale) > 0.001) {
      const offset = this.camera.position.clone().sub(this.controls.target);
      this.camera.position.copy(this.controls.target)
        .add(offset.multiplyScalar(nextFitScale / this.cameraFitScale));
      this.cameraFitScale = nextFitScale;
      this.controls.maxDistance = 85 * nextFitScale;
      this.controls.update();
    }
    this.renderer.setSize(width, height, false);
    this.requestRender();
  };

  private requestRender = () => {
    if (this.disposed || this.contextLost || this.frame) return;
    this.frame = requestAnimationFrame(this.render);
  };

  private render = (time: number) => {
    this.frame = 0;
    if (this.disposed || this.contextLost) return;
    let continuePlayback = false;
    if (this.playback) {
      const flow = this.snapshot.flows.find((item) => item.id === this.playback?.flowId);
      if (flow) {
        const playbackFrame = getFlowPlaybackFrame(
          flow, this.playback.startedAt, time, this.reducedMotion,
        );
        const sourceId = flow.nodeIds[playbackFrame.segmentIndex];
        const targetId = flow.nodeIds[playbackFrame.segmentIndex + 1];
        const source = this.positions[sourceId];
        const target = this.positions[targetId];
        if (source && target) {
          this.pulse.position.copy(curvePoint(source, target, playbackFrame.progress));
          this.pulse.visible = !this.reducedMotion;
        }
        this.updateEdgeColors(playbackFrame.segmentIndex);
        this.container.dataset.playbackPhase = playbackFrame.phase;
        continuePlayback = playbackFrame.phase === "playing";
      }
    }

    this.renderer.render(this.scene, this.camera);
    this.updateLabels();
    this.renderCount += 1;
    this.renderer.domElement.dataset.renderCount = String(this.renderCount);
    this.renderer.domElement.dataset.drawCalls = String(this.renderer.info.render.calls);
    this.renderer.domElement.dataset.triangles = String(this.renderer.info.render.triangles);
    this.renderer.domElement.dataset.dpr = String(this.renderer.getPixelRatio());
    if (continuePlayback) this.requestRender();
  };

  private updateLabels() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    for (const domainLayout of createDomainLayout()) {
      const label = this.labels.get(domainLayout.id);
      if (!label) continue;
      const projected = new THREE.Vector3(domainLayout.x, 0.2, domainLayout.z).project(this.camera);
      const visible = projected.z < 1 && projected.z > -1;
      label.style.display = visible ? "block" : "none";
      label.style.transform = `translate(-50%, -50%) translate(${(projected.x * 0.5 + 0.5) * width}px, ${(-projected.y * 0.5 + 0.5) * height}px)`;
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.resizeObserver.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("keydown", this.onKeyDown);
    canvas.removeEventListener("focus", this.onFocus);
    canvas.removeEventListener("blur", this.onBlur);
    canvas.removeEventListener("webglcontextlost", this.onContextLost);
    canvas.removeEventListener("webglcontextrestored", this.onContextRestored);
    this.controls.removeEventListener("change", this.requestRender);
    this.controls.dispose();
    this.labels.forEach((label) => label.remove());
    this.labels.clear();
    this.disposables.reverse().forEach((resource) => resource.dispose());
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    canvas.remove();
    delete this.container.dataset.sceneReady;
  }
}
