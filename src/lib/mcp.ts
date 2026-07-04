/**
 * Client MCP tricoteuses (Assemblée nationale) — transport Streamable HTTP.
 * ⚠️ Le site est protégé par un anti-bot (Anubis) qui bloque les accès
 * automatisés. On implémente donc d'abord le fallback (BDD seedée) : l'UI ne
 * lit JAMAIS le MCP en direct. La synchro MCP est optionnelle et, en cas
 * d'échec, on reste sur le seed.
 *
 * Règle de cache (§5.2) : toute réponse MCP est immédiatement persistée en BDD.
 */

const MCP_URL = process.env.MCP_TRICOTEUSES_URL ?? "https://www.tricoteuses.fr/mcp";
const MCP_TIMEOUT = Number(process.env.MCP_TIMEOUT_MS ?? 15000);

export type McpSyncResult = {
  ok: boolean;
  message: string;
  detail?: string;
  toolsCount?: number;
};

/**
 * Tente une poignée de main MCP (listTools). En cas de succès, renvoie la liste
 * des tools exposés. En cas de blocage anti-bot / timeout / erreur : renvoie un
 * échec explicite et on retombe sur le seed.
 */
export async function syncMcp(): Promise<McpSyncResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MCP_TIMEOUT);
  try {
    const res = await fetch(MCP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {}
      }),
      signal: controller.signal
    });

    const ct = res.headers.get("content-type") ?? "";
    const text = await res.text();

    // Détection du challenge anti-bot Anubis (page HTML au lieu de JSON/SSE)
    if (ct.includes("text/html") || /anubis|challenge|mining/i.test(text.slice(0, 500))) {
      return {
        ok: false,
        message:
          "MCP tricoteuses inaccessible : challenge anti-bot (Anubis) détecté. " +
          "La base de données seedée reste la source de vérité.",
        detail: `HTTP ${res.status}, content-type ${ct}`
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        message: `MCP tricoteuses a répondu HTTP ${res.status}. Fallback BDD conservé.`,
        detail: text.slice(0, 300)
      };
    }

    // Parsing best-effort (JSON direct ou SSE)
    let tools: unknown[] = [];
    try {
      const json = JSON.parse(text);
      tools = json?.result?.tools ?? [];
    } catch {
      const dataLine = text.split("\n").find((l) => l.startsWith("data:"));
      if (dataLine) {
        try {
          const json = JSON.parse(dataLine.replace(/^data:\s*/, ""));
          tools = json?.result?.tools ?? [];
        } catch {
          /* ignore */
        }
      }
    }

    return {
      ok: true,
      message: `Connexion MCP réussie. ${tools.length} outil(s) exposé(s). ` + "Les données synchronisées seraient persistées en BDD (cache obligatoire).",
      toolsCount: tools.length
    };
  } catch (e) {
    return {
      ok: false,
      message:
        "Échec de connexion au MCP tricoteuses (timeout ou réseau). " +
        "La base de données seedée reste la source de vérité.",
      detail: e instanceof Error ? e.message : String(e)
    };
  } finally {
    clearTimeout(timer);
  }
}
