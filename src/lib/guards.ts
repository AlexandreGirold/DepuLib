import { redirect } from "next/navigation";
import { getSession, Role, SessionUser } from "./session";

/**
 * Garde serveur : exige une session avec l'un des rôles autorisés.
 * Redirige vers /connexion si non connecté, vers l'espace du rôle si mauvais rôle.
 */
export async function requireRole(roles: Role[]): Promise<SessionUser> {
  const session = await getSession();
  const user = session.user;
  if (!user) redirect("/connexion");
  if (!roles.includes(user.role)) {
    switch (user.role) {
      case "citoyen":
        redirect("/citoyen");
      case "representant":
        redirect("/representant");
      default:
        redirect("/depute/dashboard");
    }
  }
  return user;
}

export function peutAgirSurRdv(user: SessionUser): boolean {
  // Le collaborateur ne peut pas accepter/refuser un RDV (F10).
  return user.role === "depute";
}
