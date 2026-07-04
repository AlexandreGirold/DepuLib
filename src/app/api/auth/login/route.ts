import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, Role, SessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

function redirectForRole(role: Role): string {
  switch (role) {
    case "citoyen":
      return "/citoyen";
    case "representant":
      return "/representant";
    case "depute":
    case "collaborateur":
      return "/depute/dashboard";
    default:
      return "/";
  }
}

export async function POST(req: Request) {
  const { username } = await req.json().catch(() => ({ username: "" }));
  const clean = String(username ?? "").trim().toLowerCase();
  if (!clean) {
    return NextResponse.json({ error: "Nom d'utilisateur requis" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { username: clean } });
  if (!user) {
    // Parcours d'inscription
    return NextResponse.json({ needsRegistration: true, username: clean });
  }

  const session = await getSession();
  session.user = {
    id: user.id,
    username: user.username,
    role: user.role as Role,
    displayName: user.displayName,
    circonscription: user.circonscription,
    commission: user.commission,
    organisationId: user.organisationId,
    deputeId: user.deputeId
  } satisfies SessionUser;
  await session.save();

  return NextResponse.json({ ok: true, redirect: redirectForRole(user.role as Role) });
}
