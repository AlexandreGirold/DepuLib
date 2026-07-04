import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, Role, SessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const username = String(body.username ?? "").trim().toLowerCase();
  const role = String(body.role ?? "citoyen") as Role;
  const displayName = String(body.displayName ?? "").trim() || username;
  const numeroHatvp = String(body.numeroHatvp ?? "").trim();
  const circonscription = String(body.circonscription ?? "").trim() || null;

  if (!username) {
    return NextResponse.json({ error: "Nom d'utilisateur requis" }, { status: 400 });
  }
  // Les rôles depute et collaborateur ne sont pas créables à l'inscription.
  if (role !== "citoyen" && role !== "representant") {
    return NextResponse.json(
      { error: "Ce rôle n'est pas ouvert à l'inscription (comptes seedés uniquement)." },
      { status: 403 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json({ error: "Ce compte existe déjà." }, { status: 409 });
  }

  let organisationId: string | null = null;
  if (role === "representant") {
    if (!numeroHatvp) {
      return NextResponse.json(
        { error: "Un numéro HATVP est requis pour le rôle représentant d'intérêts." },
        { status: 400 }
      );
    }
    const org = await prisma.organisation.findUnique({
      where: { numeroHatvp }
    });
    if (!org) {
      return NextResponse.json(
        {
          error:
            "Numéro HATVP introuvable dans le répertoire des représentants d'intérêts."
        },
        { status: 400 }
      );
    }
    organisationId = org.id;
  }

  const user = await prisma.user.create({
    data: {
      username,
      role,
      displayName,
      circonscription: role === "citoyen" ? circonscription : null,
      organisationId
    }
  });

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

  return NextResponse.json({
    ok: true,
    redirect: role === "citoyen" ? "/citoyen" : "/representant"
  });
}
