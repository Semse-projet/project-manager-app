"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../lib/cn";

export function useHtmlInCanvasSupport(): boolean {
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported(supportsHtmlInCanvas());
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
  requestPaint?: () => void;
  onpaint?: ((event: Event) => void) | null;
  captureElementImage?: (element: Element) => ImageBitmap;
};

type HtmlInCanvas2DContext = CanvasRenderingContext2D & {
  drawElementImage?: (element: Element, x: number, y: number) => unknown;
  reset?: () => void;
};

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
  const context = canvas.getContext("2d") as HtmlInCanvas2DContext | null;
  return typeof canvas.requestPaint === "function" && !!context && typeof context.drawElementImage === "function";
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
    const [enabled, setEnabled] = useState(false);

    useImperativeHandle(
      ref,
      () => ({
        getCanvas() {
          return enabled ? (canvasRef.current as HTMLCanvasElement | null) : null;
        },
        capture() {
          return new Promise<Blob | null>((resolve) => {
            const canvas = canvasRef.current as HTMLCanvasElement | null;
            if (!enabled || !canvas) { resolve(null); return; }
            canvas.toBlob((blob) => resolve(blob), "image/png");
          });
        },
        captureImageBitmap() {
          const canvas = canvasRef.current;
          const content = contentRef.current;
          if (!enabled || !canvas || !content) return Promise.resolve(null);
          if (typeof canvas.captureElementImage === "function") {
            try {
              return Promise.resolve(canvas.captureElementImage(content));
            } catch {
              return Promise.resolve(null);
            }
          }
          // Fallback: capture via toBlob → createImageBitmap
          return new Promise<ImageBitmap | null>((resolve) => {
            canvas.toBlob((blob) => {
              if (!blob) { resolve(null); return; }
              createImageBitmap(blob).then(resolve).catch(() => resolve(null));
            }, "image/png");
          });
        },
      }),
      [enabled]
    );

    useEffect(() => {
      const supported = !disabled && supportsHtmlInCanvas();
      setEnabled(supported);
      onSupportChange?.(supported);
    }, [disabled, onSupportChange]);

    useEffect(() => {
      if (!enabled) return;

      const canvas = canvasRef.current;
      const content = contentRef.current;
      if (!canvas || !content) return;

      canvas.setAttribute("layoutsubtree", "");
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
        drawContext.drawElementImage?.(contentNode, 0, 0);
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
      if (as === "section") return <section className={className} style={style} {...fallbackAttr} {...rest}>{children}</section>;
      if (as === "article") return <article className={className} style={style} {...fallbackAttr} {...rest}>{children}</article>;
      if (as === "aside") return <aside className={className} style={style} {...fallbackAttr} {...rest}>{children}</aside>;
      return <div className={className} style={style} {...fallbackAttr} {...rest}>{children}</div>;
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
