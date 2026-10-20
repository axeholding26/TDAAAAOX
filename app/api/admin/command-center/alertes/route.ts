// Alertes du contexte courant (cloche de la barre du haut).
import { NextResponse, type NextRequest } from "next/server";
import { contexteApi, analyser } from "@/lib/command-center/serveur";
import { getT } from "@/lib/i18n/serveur";
import { peutVoir } from "@/lib/command-center/rbac";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const c = await contexteApi("alertes", req);
  if (c instanceof NextResponse) return c;
  // Textes dans la langue de l'admin, comme la page /admin/alertes.
  const { alertes } = analyser(c, await getT());
  const liste = alertes.map(({ id, categorie, titre, detail, lien }) => ({ id, categorie, titre, detail, lien }));
  // Retraits à faire dans NotchPay (circuit manuel) : en tête. L'id suit le plus récent, donc un
  // nouveau retrait fait revenir l'alerte même si la précédente a été vue.
  if (peutVoir(c.session.role, "finances")) {
    const where = { statut: "en_attente", reference: null };
    const [n, dernier] = await Promise.all([prisma.retrait.count({ where }), prisma.retrait.findFirst({ where, orderBy: { createdAt: "desc" }, select: { id: true } })]);
    if (n && dernier) liste.unshift({ id: `retraits-${dernier.id}`, categorie: "critique", titre: `💸 ${n} retrait(s) à valider dans NotchPay`, detail: "Les marchands attendent leur argent : fais le transfert puis marque-le payé.", lien: "/admin/finances" });
  }
  if (peutVoir(c.session.role, "affilies")) {
    const where = { statut: "en_attente", reference: null };
    const [n, dernier] = await Promise.all([prisma.paiementCommission.count({ where }), prisma.paiementCommission.findFirst({ where, orderBy: { createdAt: "desc" }, select: { id: true } })]);
    if (n && dernier) liste.unshift({ id: `commissions-${dernier.id}`, categorie: "critique", titre: `🤝 ${n} commission(s) d'affilié à verser dans NotchPay`, detail: "Les affiliés attendent leur argent : fais le transfert puis marque-le payé.", lien: "/admin/affilies" });
  }
  return NextResponse.json({ alertes: liste });
}
