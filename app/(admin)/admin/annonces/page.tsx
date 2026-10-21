// Annonces de la bannière « Ma boutique » (espace marchand) : ajouter, modifier, mettre en pause,
// ordonner, programmer, cibler, supprimer — et suivre affichages / clics.
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSessionPour } from "@/lib/admin-auth";
import { peutAgir } from "@/lib/command-center/rbac";
import { getT } from "@/lib/i18n/serveur";
import { EnTetePage, Note } from "@/components/command-center/ui";
import { GestionAnnonces } from "./GestionAnnonces";

export default async function AnnoncesPage() {
  const t = await getT();
  const session = await getAdminSessionPour("annonces");
  if (!session) redirect("/admin?refus=1");
  const annonces = await prisma.annonce.findMany({ orderBy: [{ ordre: "asc" }, { createdAt: "asc" }] });

  return (
    <div className="space-y-5">
      <EnTetePage eyebrow={t("Gestion")} titre={t("Annonces")} sousTitre={t("Bannière publicitaire de « Ma boutique » · partenaires et services Axso")} />
      <Note>{t("La bannière s'affiche une fois par semaine à chaque marchand, à un moment aléatoire, et fait défiler les annonces actives dans l'ordre. Ciblage vide = toutes les boutiques. Aucune annonce active : la bannière disparaît.")}</Note>
      <GestionAnnonces lecture={!peutAgir(session.role)}
        initial={annonces.map(({ createdAt: _c, updatedAt: _u, ...a }) => ({ ...a, debut: a.debut?.toISOString() ?? null, fin: a.fin?.toISOString() ?? null }))} />
    </div>
  );
}
