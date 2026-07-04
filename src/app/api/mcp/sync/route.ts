import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { syncMcp } from "@/lib/mcp";

export const dynamic = "force-dynamic";

/**
 * Tentative de synchronisation MCP tricoteuses (réservé rôle depute).
 * En cas de blocage anti-bot / échec : logge et conserve le seed BDD.
 */
export async function POST() {
  const user = await requireUser();
  if (!user || user.role !== "depute") {
    return NextResponse.json({ error: "Réservé au rôle député" }, { status: 403 });
  }
  const result = await syncMcp();
  // eslint-disable-next-line no-console
  console.log("[mcp/sync]", result.ok ? "OK" : "FALLBACK", "-", result.message);
  return NextResponse.json(result);
}
