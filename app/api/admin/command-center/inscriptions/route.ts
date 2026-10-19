// Nouveaux inscrits (marchands et livreurs) depuis `depuis` (moins 2 min) : alimente l'alerte sonore
// du Command Center (components/admin/AlerteInscription.tsx). Sans `depuis`, renvoie
// seulement l'heure du serveur : les inscriptions plus anciennes n'alertent jamais.
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSessionPour } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const session = await getAdminSessionPour("marchands");
  if (!session) return NextResponse.json({ erreur: "Accès refusé" }, { status: 403 });

  const maintenant = new Date();
  const brut = req.nextUrl.searchParams.get("depuis");
  const depuis = brut ? new Date(brut) : null;
  if (!depuis || isNaN(depuis.getTime())) return NextResponse.json({ a: maintenant.toISOString(), inscrits: [] });

  const inscrits = await prisma.user.findMany({
    // Fenêtre élargie de 2 min : l'inscription crée le compte dans une transaction de quelques
    // secondes, il peut donc apparaître après coup avec une date antérieure. Le client
    // ignore les comptes déjà annoncés.
    where: { createdAt: { gt: new Date(depuis.getTime() - 120_000), lte: maintenant }, role: { in: ["owner", "livreur"] } },
    orderBy: { createdAt: "asc" },
    take: 20,
    select: { id: true, name: true, email: true, role: true, createdAt: true, tenantId: true },
  });
  const ids = inscrits.map((u) => u.tenantId).filter((t): t is string => !!t);
  const boutiques = new Map((ids.length ? await prisma.tenant.findMany({ where: { id: { in: ids } }, select: { id: true, nomBoutique: true } }) : []).map((t) => [t.id, t.nomBoutique]));
  return NextResponse.json({
    a: maintenant.toISOString(),
    inscrits: inscrits.map((u) => ({
      id: u.id, nom: u.name, email: u.email, role: u.role, le: u.createdAt,
      boutique: (u.tenantId && boutiques.get(u.tenantId)) || null,
      // Marchand sans boutique encore créée : la liste des marchands plutôt que celle des livreurs.
      lien: u.role === "livreur" ? "/admin/livreurs" : u.tenantId ? `/admin/marchands/${u.tenantId}` : "/admin/marchands",
    })),
  });
}
