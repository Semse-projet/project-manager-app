"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../lib/cn";

export function useHtmlInCanvasSupport(): boolean {
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let timeoutId: number | undefined;

    function detect() {
      if (cancelled) return;
      const nextSupported = supportsHtmlInCanvas();
      setSupported(nextSupported);
      if (nextSupported || attempts >= SUPPORT_DETECTION_RETRIES) return;
      attempts += 1;
      timeoutId = window.setTimeout(detect, SUPPORT_DETECTION_RETRY_MS);
    }

    detect();
    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);
  return supported;
}

export interface HtmlInCanvasPanelHandle {
  /** Captures the current visual state as a PNG Blob. Returns null when canvas not active. */
  capture(): Promise<Blob | null>;
  /** Returns the underlying HTMLCanvasElement, or null when in DOM-fallback mode. */
  getCanvas(): HTMLCanvasElement | null;
  /** Captures as ImageBitmap for use as WebGL/WebGPU texture. Returns null when not supported. */
  captureImageBitmap(): Promise<ImageBitmap | null>;
}

type HtmlInCanvasPanelTag = "div" | "section" | "article" | "aside";

type HtmlInCanvasCanvasElement = HTMLCanvasElement & {
  layoutSubtree?: boolean;
  requestPaint?: () => void;
  onpaint?: ((event: Event) => void) | null;
  captureElementImage?: (element: Element) => ImageBitmap;
};

type HtmlInCanvas2DContext = CanvasRenderingContext2D & {
  drawElementImage?: (element: Element, x: number, y: number) => unknown;
  reset?: () => void;
};

const FALLBACK_IMAGE_LOAD_TIMEOUT_MS = 5000;
const MAX_FALLBACK_DPR = 3;
const MAX_FALLBACK_PIXELS = 16_000_000;
const SUPPORT_DETECTION_RETRIES = 12;
const SUPPORT_DETECTION_RETRY_MS = 250;

export interface HtmlInCanvasPanelProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  as?: HtmlInCanvasPanelTag;
  style?: CSSProperties;
  canvasClassName?: string;
  canvasStyle?: CSSProperties;
  minHeight?: number;
  disabled?: boolean;
  onSupportChange?: (supported: boolean) => void;
}

function supportsHtmlInCanvas(): boolean {
  if (typeof window === "undefined") return false;
  const canvas = document.createElement("canvas") as HtmlInCanvasCanvasElement;
  canvas.setAttribute("layoutsubtree", "");
  canvas.layoutSubtree = true;
  const context = canvas.getContext("2d") as HtmlInCanvas2DContext | null;
  return typeof canvas.requestPaint === "function" && !!context && typeof context.drawElementImage === "function";
}

function copyComputedStyles(source: Element, target: Element) {
  const computed = window.getComputedStyle(source);
  const targetElement = target as HTMLElement;
  targetElement.style.cssText = Array.from(computed)
    .map((property) => `${property}:${computed.getPropertyValue(property)};`)
    .join("");
}

function syncFormState(source: Element, target: Element) {
  if (source instanceof HTMLTextAreaElement && target instanceof HTMLTextAreaElement) {
    target.textContent = source.value;
    return;
  }

  if (source instanceof HTMLInputElement && target instanceof HTMLInputElement) {
    if (source.type === "checkbox" || source.type === "radio") {
      if (source.checked) target.setAttribute("checked", "");
      else target.removeAttribute("checked");
    } else {
      target.setAttribute("value", source.value);
    }
    return;
  }

  if (source instanceof HTMLSelectElement && target instanceof HTMLSelectElement) {
    Array.from(source.options).forEach((option, index) => {
      if (option.selected) target.options[index]?.setAttribute("selected", "");
      else target.options[index]?.removeAttribute("selected");
    });
  }
}

function inlineComputedStyles(source: Element, target: Element) {
  copyComputedStyles(source, target);
  syncFormState(source, target);

  const sourceChildren = Array.from(source.children);
  const targetChildren = Array.from(target.children);
  sourceChildren.forEach((child, index) => {
    const targetChild = targetChildren[index];
    if (targetChild) inlineComputedStyles(child, targetChild);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    } catch {
      resolve(null);
    }
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timeoutId = window.setTimeout(() => {
      image.onload = null;
      image.onerror = null;
      reject(new Error("Fallback capture image load timed out"));
    }, FALLBACK_IMAGE_LOAD_TIMEOUT_MS);
    image.onload = () => {
      window.clearTimeout(timeoutId);
      resolve(image);
    };
    image.onerror = () => {
      window.clearTimeout(timeoutId);
      reject(new Error("Unable to load fallback capture image"));
    };
    image.src = src;
  });
}

function resolveFallbackScale(width: number, height: number) {
  const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), MAX_FALLBACK_DPR);
  const maxScaleByArea = Math.sqrt(MAX_FALLBACK_PIXELS / Math.max(width * height, 1));
  return Math.max(1, Math.min(dpr, maxScaleByArea));
}

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function captureElementFallback(element: HTMLElement, minHeight?: number): Promise<Blob | null> {
  const rect = element.getBoundingClientRect();
  const width = Math.max(1, Math.ceil(rect.width || element.scrollWidth || 1));
  const height = Math.max(minHeight ?? 0, Math.ceil(element.scrollHeight || rect.height || 1));
  const clone = element.cloneNode(true) as HTMLElement;

  inlineComputedStyles(element, clone);
  clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.boxSizing = "border-box";

  const html = new XMLSerializer().serializeToString(clone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%">${html}</foreignObject></svg>`;
  const url = svgToDataUrl(svg);

  try {
    const image = await loadImage(url);
    const scale = resolveFallbackScale(width, height);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return null;

    canvas.width = Math.max(1, Math.ceil(width * scale));
    canvas.height = Math.max(1, Math.ceil(height * scale));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.scale(scale, scale);
    context.drawImage(image, 0, 0, width, height);
    return canvasToBlob(canvas);
  } catch {
    return null;
  }
}

export const HtmlInCanvasPanel = forwardRef<HtmlInCanvasPanelHandle, HtmlInCanvasPanelProps>(
  function HtmlInCanvasPanel(
    {
      children,
      as = "div",
      className,
      style,
      canvasClassName,
      canvasStyle,
      minHeight,
      disabled = false,
      onSupportChange,
      ...rest
    },
    ref
  ) {
    const canvasRef = useRef<HtmlInCanvasCanvasElement | null>(null);
    const contentRef = useRef<HTMLDivElement | null>(null);
    const fallbackRef = useRef<HTMLElement | null>(null);
    const [enabled, setEnabled] = useState(false);

    async function captureCurrentFrame() {
      const canvas = canvasRef.current as HTMLCanvasElement | null;
      if (enabled && canvas) return canvasToBlob(canvas);

      const fallback = fallbackRef.current;
      if (!fallback) return null;
      return captureElementFallback(fallback, minHeight);
    }

    useImperativeHandle(
      ref,
      () => ({
        getCanvas() {
          return enabled ? (canvasRef.current as HTMLCanvasElement | null) : null;
        },
        capture: captureCurrentFrame,
        async captureImageBitmap() {
          const canvas = canvasRef.current;
          const content = contentRef.current;
          if (enabled && canvas && content && typeof canvas.captureElementImage === "function") {
            try {
              return canvas.captureElementImage(content);
            } catch {
              return null;
            }
          }

          const blob = await captureCurrentFrame();
          if (!blob) return null;
          return createImageBitmap(blob).catch(() => null);
        },
      }),
      [enabled, minHeight]
    );

    useEffect(() => {
      let cancelled = false;
      let attempts = 0;
      let timeoutId: number | undefined;

      function detect() {
        if (cancelled) return;
        const supported = !disabled && supportsHtmlInCanvas();
        setEnabled(supported);
        onSupportChange?.(supported);
        if (supported || disabled || attempts >= SUPPORT_DETECTION_RETRIES) return;
        attempts += 1;
        timeoutId = window.setTimeout(detect, SUPPORT_DETECTION_RETRY_MS);
      }

      detect();
      return () => {
        cancelled = true;
        if (timeoutId) window.clearTimeout(timeoutId);
      };
    }, [disabled, onSupportChange]);

    useEffect(() => {
      if (!enabled) return;

      const canvas = canvasRef.current;
      const content = contentRef.current;
      if (!canvas || !content) return;

      canvas.setAttribute("layoutsubtree", "");
      canvas.layoutSubtree = true;
      const context = canvas.getContext("2d") as HtmlInCanvas2DContext | null;

      if (!context || typeof context.drawElementImage !== "function") {
        setEnabled(false);
        return;
      }

      const surface = canvas;
      const contentNode = content;
      const drawContext = context;
      let frameId = 0;
      const resizeObserver = new ResizeObserver(scheduleDraw);
      const mutationObserver = new MutationObserver(scheduleDraw);

      function draw() {
        frameId = 0;
        const rect = contentNode.getBoundingClientRect();
        const width = Math.max(1, Math.ceil(rect.width));
        const height = Math.max(minHeight ?? 0, Math.ceil(contentNode.scrollHeight || rect.height || 1));
        const dpr = window.devicePixelRatio || 1;

        surface.style.height = `${height}px`;
        surface.width = Math.max(1, Math.ceil(width * dpr));
        surface.height = Math.max(1, Math.ceil(height * dpr));

        if (typeof drawContext.reset === "function") {
          drawContext.reset();
        } else {
          drawContext.setTransform(1, 0, 0, 1, 0, 0);
          drawContext.clearRect(0, 0, surface.width, surface.height);
        }

        drawContext.scale(dpr, dpr);
        drawContext.clearRect(0, 0, width, height);
        const transform = drawContext.drawElementImage?.(contentNode, 0, 0);
        if (transform && typeof transform === "object" && "toString" in transform) {
          contentNode.style.transform = transform.toString();
        }
      }

      function scheduleDraw() {
        if (frameId) return;
        frameId = window.requestAnimationFrame(draw);
        surface.requestPaint?.();
      }

      resizeObserver.observe(surface);
      resizeObserver.observe(contentNode);
      mutationObserver.observe(contentNode, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });

      surface.onpaint = () => scheduleDraw();
      window.addEventListener("resize", scheduleDraw);
      scheduleDraw();

      return () => {
        if (frameId) window.cancelAnimationFrame(frameId);
        resizeObserver.disconnect();
        mutationObserver.disconnect();
        surface.onpaint = null;
        window.removeEventListener("resize", scheduleDraw);
      };
    }, [children, enabled, minHeight]);

    if (!enabled) {
      const fallbackAttr = { "data-semse-html-in-canvas": "fallback" } as Record<string, string>;
      if (as === "section") return <section ref={(node) => { fallbackRef.current = node; }} className={className} style={style} {...fallbackAttr} {...rest}>{children}</section>;
      if (as === "article") return <article ref={(node) => { fallbackRef.current = node; }} className={className} style={style} {...fallbackAttr} {...rest}>{children}</article>;
      if (as === "aside") return <aside ref={(node) => { fallbackRef.current = node; }} className={className} style={style} {...fallbackAttr} {...rest}>{children}</aside>;
      return <div ref={(node) => { fallbackRef.current = node; }} className={className} style={style} {...fallbackAttr} {...rest}>{children}</div>;
    }

    return (
      <canvas
        ref={canvasRef}
        className={cn("block w-full bg-transparent", canvasClassName)}
        style={canvasStyle}
        data-semse-html-in-canvas="enabled"
        {...rest}
      >
        <div ref={contentRef} className={className} style={style}>
          {children}
        </div>
      </canvas>
    );
  }
);
