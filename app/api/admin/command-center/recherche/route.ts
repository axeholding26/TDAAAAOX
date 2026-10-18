// Recherche ⌘K côté serveur : marchands (nom) et commandes (numéro).
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { contexteApi } from "@/lib/command-center/serveur";
import { nomPays, NOM_PLAN } from "@/lib/command-center/types";

export async function GET(req: NextRequest) {
  const c = await contexteApi("marchands", req);
  if (c instanceof NextResponse) return c;
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 60).toLowerCase();
  if (q.length < 2) return NextResponse.json({ resultats: [] });
  const marchands = c.ds.marchands.filter((m) => m.nom.toLowerCase().includes(q)).slice(0, 6)
    .map((m) => ({ id: `mc:${m.id}`, type: "Marchand", titre: m.nom, sous: `${nomPays(m.pays)} · ${NOM_PLAN[m.plan]}`, href: `/admin/marchands/${m.id}` }));
  const commandes = c.filtres.source === "reel" && /[0-9-]{3,}/.test(q)
    ? (await prisma.commande.findMany({ where: { numero: { contains: q.toUpperCase() } }, take: 5, select: { numero: true, tenantId: true, montantTotal: true, devise: true } }))
      .map((x) => ({ id: `co:${x.numero}`, type: "Commande", titre: x.numero, sous: `${Math.round(x.montantTotal).toLocaleString("fr-FR")} ${x.devise}`, href: `/admin/marchands/${x.tenantId}` }))
    : [];
  return NextResponse.json({ resultats: [...marchands, ...commandes] });
}
