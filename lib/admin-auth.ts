import { auth } from "./auth";

export type RoleAdmin = "admin" | "admin_lecteur";

export interface AdminSession {
  userId: string;
  email: string;
  role: RoleAdmin;
}

// Page components : appeler puis `if (!session) redirect(...)`.
export async function getAdminSession(): Promise<AdminSession | null> {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session || (role !== "admin" && role !== "admin_lecteur")) return null;
  return {
    userId: (session.user as any).id,
    email: session.user?.email ?? "",
    role,
  };
}

// true uniquement pour le rôle "admin" complet — le rôle "admin_lecteur" ne
// peut jamais déclencher une action qui mute des données ou déplace de l'argent.
export function estAdminComplet(session: AdminSession | null): boolean {
  return session?.role === "admin";
}
