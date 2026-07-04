import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";

export type Role = "citoyen" | "representant" | "depute" | "collaborateur";

export type SessionUser = {
  id: string;
  username: string;
  role: Role;
  displayName: string;
  circonscription?: string | null;
  commission?: string | null;
  organisationId?: string | null;
  deputeId?: string | null;
};

export type SessionData = {
  user?: SessionUser;
};

const sessionOptions = {
  password:
    process.env.SESSION_SECRET ?? "depulib-poc-changez-moi-32-caracteres-min",
  cookieName: "depulib_session",
  cookieOptions: {
    // POC servi en HTTP (IP:3000, pas de TLS) : le cookie ne doit PAS être Secure,
    // sinon le navigateur le rejette et l'auth casse. Mettre COOKIE_SECURE=true
    // seulement derrière du HTTPS.
    secure: process.env.COOKIE_SECURE === "true",
    httpOnly: true,
    sameSite: "lax" as const
  }
};

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(cookies(), sessionOptions);
}

export async function requireUser(): Promise<SessionUser | null> {
  const session = await getSession();
  return session.user ?? null;
}
