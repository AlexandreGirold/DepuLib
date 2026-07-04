import fs from "node:fs";
import path from "node:path";
import { pseudoEmbedding } from "./cosinus";

/**
 * Client bas niveau Cloud Temple LLMaaS (API compatible OpenAI).
 * Documentation : https://docs.cloud-temple.com/llmaas
 *
 * Trois fonctions : chat(), embed(), listModels().
 * Timeout 20 s, 1 retry backoff 2 s, parsing JSON robuste.
 * Mode mock automatique si clé absente ou 3 échecs consécutifs.
 */

const BASE_URL =
  process.env.CLOUDTEMPLE_LLMAAS_BASE_URL ??
  "https://api.ai.cloud-temple.com/v1";
const API_KEY = process.env.CLOUDTEMPLE_LLMAAS_API_KEY ?? "";
const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS ?? 20000);

export const MODELS = {
  main: process.env.LLM_MODEL_MAIN ?? "mistral-small4:119b",
  fast: process.env.LLM_MODEL_FAST ?? "mistral-small4:119b",
  embed: process.env.LLM_MODEL_EMBED ?? "bge-m3:567m"
};

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

// ---- État global du mode dégradé --------------------------------------

let consecutiveFailures = 0;
let forcedMock = API_KEY.trim() === "";
let lastError: string | null = forcedMock
  ? "Aucune clé CLOUDTEMPLE_LLMAAS_API_KEY configurée"
  : null;

export function iaStatus(): {
  mode: "connecte" | "degrade";
  reason: string | null;
  model: string;
} {
  const degraded = forcedMock || consecutiveFailures >= 3;
  return {
    mode: degraded ? "degrade" : "connecte",
    reason: degraded ? lastError : null,
    model: MODELS.main
  };
}

function isMockMode(): boolean {
  return forcedMock || consecutiveFailures >= 3;
}

// ---- Mock déterministe ------------------------------------------------

type MockDb = {
  chat: Record<string, unknown>;
  defaults: Record<string, unknown>;
};

let mockCache: MockDb | null = null;

function loadMock(): MockDb {
  if (mockCache) return mockCache;
  try {
    const p = path.join(process.cwd(), "seed", "mock-llm.json");
    mockCache = JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    mockCache = { chat: {}, defaults: {} };
  }
  return mockCache!;
}

/**
 * Sélectionne une réponse mock. La clé de routage `mockKey` (fournie par ia.ts)
 * pointe vers une entrée déterministe pré-écrite dans seed/mock-llm.json.
 */
function mockChat(mockKey: string | undefined, json: boolean): string {
  const db = loadMock();
  if (mockKey && db.chat[mockKey] !== undefined) {
    const v = db.chat[mockKey];
    return typeof v === "string" ? v : JSON.stringify(v);
  }
  const fallback =
    db.defaults[json ? "json" : "text"] ??
    (json
      ? { contenu: "information non disponible dans les sources", sources: [] }
      : "information non disponible dans les sources");
  return typeof fallback === "string" ? fallback : JSON.stringify(fallback);
}

// ---- Parsing JSON robuste ---------------------------------------------

export function parseJsonLoose<T = unknown>(raw: string): T | null {
  if (!raw) return null;
  let s = raw.trim();
  // Strip des fences ```json ... ```
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  // Extraction du premier objet/tableau JSON présent
  const firstBrace = s.search(/[[{]/);
  if (firstBrace > 0) s = s.slice(firstBrace);
  const lastBrace = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
  if (lastBrace >= 0) s = s.slice(0, lastBrace + 1);
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

// ---- Appels HTTP ------------------------------------------------------

async function httpJson(
  endpoint: string,
  body: unknown,
  timeoutMs = TIMEOUT_MS
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${text.slice(0, 200)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    await new Promise((r) => setTimeout(r, 2000));
    return await fn();
  }
}

function noteSuccess() {
  consecutiveFailures = 0;
  lastError = null;
}

function noteFailure(e: unknown) {
  consecutiveFailures += 1;
  lastError = e instanceof Error ? e.message : String(e);
}

// ---- API publique -----------------------------------------------------

export type ChatOptions = {
  model?: string;
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  /** Clé de routage vers une réponse mock déterministe. */
  mockKey?: string;
};

export async function chat(
  messages: ChatMessage[],
  opts: ChatOptions = {}
): Promise<string> {
  const {
    model = MODELS.main,
    json = false,
    maxTokens = 1200,
    temperature = 0.1,
    mockKey
  } = opts;

  if (isMockMode()) {
    return mockChat(mockKey, json);
  }

  try {
    const body: Record<string, unknown> = {
      model,
      messages,
      max_tokens: maxTokens,
      temperature
    };
    if (json) {
      body.response_format = { type: "json_object" };
    }
    const data = await withRetry(() => httpJson("/chat/completions", body));
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    noteSuccess();
    return content;
  } catch (e) {
    noteFailure(e);
    // Bascule mock si le seuil est atteint
    return mockChat(mockKey, json);
  }
}

export async function embed(texts: string[]): Promise<number[][]> {
  if (isMockMode()) {
    return texts.map((t) => pseudoEmbedding(t));
  }
  try {
    const data = await withRetry(() =>
      httpJson("/embeddings", { model: MODELS.embed, input: texts })
    );
    const vectors: number[][] = (data?.data ?? []).map(
      (d: any) => d.embedding as number[]
    );
    if (vectors.length !== texts.length || vectors.some((v) => !v)) {
      throw new Error("Réponse embeddings incomplète");
    }
    noteSuccess();
    return vectors;
  } catch (e) {
    noteFailure(e);
    return texts.map((t) => pseudoEmbedding(t));
  }
}

export async function listModels(): Promise<string[]> {
  if (isMockMode()) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    noteSuccess();
    return (data?.data ?? []).map((m: any) => m.id as string);
  } catch (e) {
    noteFailure(e);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Au démarrage : vérifie la disponibilité des modèles imposés. Si un identifiant
 * est absent du catalogue, on garde la valeur configurée (le fallback mock prend
 * le relais en cas d'échec réel). On logge la résolution.
 */
export async function ensureModels(): Promise<void> {
  if (isMockMode()) return;
  const available = await listModels();
  if (available.length === 0) return;
  for (const [key, id] of Object.entries(MODELS) as [
    keyof typeof MODELS,
    string
  ][]) {
    if (!available.includes(id)) {
      // Auto-sélection : premier modèle de la même famille lexicale
      const family = id.split(/[:/]/)[0];
      const alt = available.find((m) => m.includes(family)) ?? available[0];
      // eslint-disable-next-line no-console
      console.warn(
        `[llmaas] Modèle ${id} absent du catalogue, bascule vers ${alt}`
      );
      MODELS[key] = alt;
    }
  }
}
