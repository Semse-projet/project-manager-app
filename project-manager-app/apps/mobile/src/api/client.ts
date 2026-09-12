import * as SecureStore from "expo-secure-store";
import { API_BASE_URL } from "../config/environment";
export { API_BASE_URL } from "../config/environment";

const ACCESS_TOKEN_KEY = "semse.accessToken";
const REFRESH_TOKEN_KEY = "semse.refreshToken";
const REQUEST_TIMEOUT_MS = 20_000;
type Tokens = { accessToken: string; refreshToken: string };
let generation = 0;
let storageQueue: Promise<void> = Promise.resolve();
let refreshFlight: { generation: number; promise: Promise<string | null> } | null = null;
const expiredListeners = new Set<() => void>();

export function subscribeSessionExpired(listener: () => void): () => void {
  expiredListeners.add(listener);
  return () => { expiredListeners.delete(listener); };
}

function serializeStorage(action: () => Promise<void>): Promise<void> {
  const pending = storageQueue.then(action, action);
  storageQueue = pending.catch(() => undefined);
  return pending;
}

function writeTokens(tokens: Tokens, expectedGeneration: number): Promise<void> {
  return serializeStorage(async () => {
    if (generation !== expectedGeneration) return;
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
  });
}

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export async function getAccessToken(): Promise<string | null> {
  await storageQueue;
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function setTokens(tokens: Tokens): Promise<void> {
  if (!tokens?.accessToken || !tokens.refreshToken) throw new ApiError("La respuesta de sesión está incompleta.", 502);
  const nextGeneration = ++generation;
  await writeTokens(tokens, nextGeneration);
}

export async function clearTokens(): Promise<void> {
  generation += 1;
  await serializeStorage(async () => {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  });
}

export async function hasSession(): Promise<boolean> {
  return (await getAccessToken()) !== null;
}

async function expireSession(expectedGeneration: number): Promise<void> {
  if (generation !== expectedGeneration) return;
  await clearTokens();
  if (generation !== expectedGeneration + 1) return;
  for (const listener of expiredListeners) listener();
}

function errorMessage(body: unknown, status: number): string {
  if (typeof body === "string" && body.trim()) return body;
  if (Array.isArray(body)) return body.map((part) => errorMessage(part, status)).join(". ");
  if (body && typeof body === "object") {
    const value = body as { error?: unknown; message?: unknown };
    if (value.error) return errorMessage(value.error, status);
    if (value.message) return errorMessage(value.message, status);
  }
  return `No se pudo completar la solicitud (${status}).`;
}

async function request(path: string, init?: RequestInit, token?: string | null): Promise<{ res: Response; body: unknown }> {
  const url = new URL(path, API_BASE_URL);
  if (!path.startsWith("/v1/") || path.includes("\\") || path.includes("..") || url.origin !== API_BASE_URL || url.hash) {
    throw new ApiError("La ruta de API no es válida.", 400);
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  init?.signal?.addEventListener("abort", abort, { once: true });
  if (init?.signal?.aborted) controller.abort();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, REQUEST_TIMEOUT_MS);
  try {
    const headers = new Headers(init?.headers);
    headers.set("accept", "application/json");
    if (init?.body && !headers.has("content-type") && typeof init.body === "string") headers.set("content-type", "application/json");
    if (token) headers.set("authorization", `Bearer ${token}`);
    const headerRecord: Record<string, string> = {};
    headers.forEach((value, key) => { headerRecord[key] = value; });
    const res = await fetch(url.toString(), { ...init, headers: headerRecord, signal: controller.signal, redirect: "error" });
    const body: unknown = res.status === 204 ? undefined : await res.json().catch(() => undefined);
    return { res, body };
  } catch (error) {
    if (init?.signal?.aborted) throw error;
    throw new ApiError(timedOut ? "La conexión tardó demasiado. Intenta de nuevo." : "No se pudo conectar con SEMSE. Revisa tu conexión.", 0);
  } finally {
    clearTimeout(timer);
    init?.signal?.removeEventListener("abort", abort);
  }
}

async function refreshAccessToken(expectedGeneration: number): Promise<string | null> {
  if (refreshFlight?.generation === expectedGeneration) return refreshFlight.promise;
  const promise = (async () => {
    const refreshToken = await getRefreshToken();
    if (generation !== expectedGeneration) return null;
    if (!refreshToken) { await expireSession(expectedGeneration); return null; }
    const { res, body } = await request("/v1/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken }) });
    if (generation !== expectedGeneration) return null;
    if (res.status === 401 || res.status === 403) { await expireSession(expectedGeneration); return null; }
    if (!res.ok) throw new ApiError(errorMessage(body, res.status), res.status);
    const tokens = (body as { data?: Tokens } | undefined)?.data;
    if (!tokens?.accessToken || !tokens.refreshToken) throw new ApiError("La respuesta de sesión está incompleta.", 502);
    await writeTokens(tokens, expectedGeneration);
    return generation === expectedGeneration ? tokens.accessToken : null;
  })();
  const flight = { generation: expectedGeneration, promise };
  refreshFlight = flight;
  try { return await promise; }
  finally { if (refreshFlight === flight) refreshFlight = null; }
}

/**
 * Talks directly to `apps/api` (no Next.js BFF involved — the mobile app isn't
 * a browser). Every request carries `Authorization: Bearer <accessToken>`; a
 * single 401 triggers one refresh-and-retry before giving up.
 */
export async function apiFetch<T>(path: string, init?: RequestInit, allowRefresh = true): Promise<T> {
  const expectedGeneration = generation;
  const token = await getAccessToken();
  if (generation !== expectedGeneration) throw new ApiError("La sesión cambió. Intenta de nuevo.", 401);
  let { res, body } = await request(path, init, token);
  if (generation !== expectedGeneration) throw new ApiError("La sesión cambió.", 401);
  if (res.status === 401 && allowRefresh && token) {
    // Another request may already have rotated the token before this 401 arrived.
    const currentToken = await getAccessToken();
    const refreshed = currentToken && currentToken !== token ? currentToken : await refreshAccessToken(expectedGeneration);
    if (refreshed && generation === expectedGeneration) ({ res, body } = await request(path, init, refreshed));
    if (generation !== expectedGeneration) throw new ApiError("La sesión ha terminado.", 401);
    if (res.status === 401) await expireSession(expectedGeneration);
  }
  if (!res.ok) throw new ApiError(errorMessage(body, res.status), res.status);
  if (res.status === 204) return undefined as T;
  if (!body || typeof body !== "object" || !("data" in body)) throw new ApiError("La respuesta de SEMSE no tiene el formato esperado.", 502);
  return (body as { data: T }).data;
}
