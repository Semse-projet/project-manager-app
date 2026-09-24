"use client";

// Sense Vision — browser-only helpers (camera frame capture + speech).
// Spec: docs/specs/vision/sense-vision-field-library.spec.md §4 P14 / §2.8.
import { fitWithin, pickVoice } from "./live-loop";

export const FRAME_MAX_EDGE_PX = 1024;
export const FRAME_JPEG_QUALITY = 0.7;

export type CapturedFrame = { imageData: string; mimeType: "image/jpeg" };

/**
 * Grabs the current video frame into an off-screen canvas, downscaled and
 * JPEG-compressed. The frame only exists in memory until the request that
 * carries it finishes — nothing is written to storage.
 */
export function captureVideoFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): CapturedFrame | null {
  if (video.readyState < 2 || video.videoWidth === 0) return null;
  const { width, height } = fitWithin(video.videoWidth, video.videoHeight, FRAME_MAX_EDGE_PX);
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(video, 0, 0, width, height);
  const dataUrl = canvas.toDataURL("image/jpeg", FRAME_JPEG_QUALITY);
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return null;
  return { imageData: dataUrl.slice(comma + 1), mimeType: "image/jpeg" };
}

export function isSpeechAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

/** Speaks `text` with an en-US / es-ES voice when available. Returns false if speech is unsupported. */
export function speak(text: string, lang: "en-US" | "es-ES"): boolean {
  if (!isSpeechAvailable()) return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.9;
  const voice = pickVoice(synth.getVoices(), lang);
  if (voice) utterance.voice = voice;
  synth.speak(utterance);
  return true;
}
