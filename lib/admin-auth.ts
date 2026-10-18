import { auth } from "./auth";
import { prisma } from "./prisma";
import { estRoleAdmin, peutVoir, type RoleAdmin, type Section } from "./command-center/rbac";

export type { RoleAdmin };

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
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, email: true } });
  const role = user?.role;
  if (!estRoleAdmin(role)) return null;
  // E-mail relu en base aussi : c'est lui qui signe le journal d'audit.
  return { userId, email: user?.email ?? session.user?.email ?? "", role };
}

/** Session admin autorisée à voir cette section (RBAC, lib/command-center/rbac.ts), sinon null. */
export async function getAdminSessionPour(section: Section): Promise<AdminSession | null> {
  const s = await getAdminSession();
  return s && peutVoir(s.role, section) ? s : null;
}

// true uniquement pour le rôle "admin" complet — le rôle "admin_lecteur" ne
// peut jamais déclencher une action qui mute des données ou déplace de l'argent.
export function estAdminComplet(session: AdminSession | null): boolean {
  return session?.role === "admin";
}
