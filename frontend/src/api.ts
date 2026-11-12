import type { Analysis, HorizonRow, Meta, Params } from "./types";

// Same-origin by default (Vite proxy in dev, nginx in Docker, rewrites on Vercel).
const BASE = import.meta.env.VITE_API_BASE ?? "";

async function getJson<T>(path: string, query?: Record<string, string | number>, signal?: AbortSignal): Promise<T> {
  const qs = query ? `?${new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)]))}` : "";
  const res = await fetch(`${BASE}${path}${qs}`, { signal });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(typeof body.detail === "string" ? body.detail : `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const fetchMeta = (signal?: AbortSignal) => getJson<Meta>("/api/meta", undefined, signal);

export const fetchAnalysis = (p: Params, signal?: AbortSignal) =>
  getJson<Analysis>("/api/analysis", { start: p.start, end: p.end, mode: p.mode, horizon: p.horizon, gate: p.gate }, signal);

export const fetchHorizonCurve = (start: string, end: string, signal?: AbortSignal) =>
  getJson<{ rows: HorizonRow[] }>("/api/horizon-curve", { start, end }, signal).then((r) => r.rows);
