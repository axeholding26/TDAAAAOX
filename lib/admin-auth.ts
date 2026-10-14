import { auth } from "./auth";
import { prisma } from "./prisma";

export type RoleAdmin = "admin" | "admin_lecteur";

export interface AdminSession {
  userId: string;
  email: string;
  role: RoleAdmin;
}

// Page components : appeler puis `if (!session) redirect(...)`.
export async function getAdminSession(): Promise<AdminSession | null> {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!session || !userId) return null;
  // Rôle relu en base à chaque appel : celui du jeton est figé à la connexion
  // (un admin rétrogradé garderait sinon l'accès jusqu'à l'expiration du cookie).
  const role = (await prisma.user.findUnique({ where: { id: userId }, select: { role: true } }))?.role;
  if (role !== "admin" && role !== "admin_lecteur") return null;
  return {
    userId,
    email: session.user?.email ?? "",
    role,
  };
}

// true uniquement pour le rôle "admin" complet — le rôle "admin_lecteur" ne
// peut jamais déclencher une action qui mute des données ou déplace de l'argent.
export function estAdminComplet(session: AdminSession | null): boolean {
  return session?.role === "admin";
}
