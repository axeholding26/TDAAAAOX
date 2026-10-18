// Modération des avis des marchands sur Axso : rien n'est publié sur la landing sans validation.
import Link from "next/link";
import { redirect } from "next/navigation";
import { Star } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getAdminSessionPour } from "@/lib/admin-auth";
import { peutAgir } from "@/lib/command-center/rbac";
import { nomPays } from "@/lib/command-center/types";
import { formats } from "@/lib/command-center/format";
import { getT } from "@/lib/i18n/serveur";
import { EnTetePage, Carte, Badge, EtatVide, Onglets, Note } from "@/components/command-center/ui";
import { Moderation } from "./Moderation";

const STATUTS = [
  { id: "en_attente", nom: "En attente" },
  { id: "approuve", nom: "Publiés" },
  { id: "refuse", nom: "Refusés" },
] as const;

export default async function AvisPlateformePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const t = await getT();
  const { dateCourte } = formats(t);
  const session = await getAdminSessionPour("avis");
  if (!session) redirect("/admin?refus=1");
  const sp = await searchParams;
  const statut = STATUTS.find((s) => s.id === sp.statut)?.id ?? "en_attente";

  const [compteurs, avis, moyenne] = await Promise.all([
    prisma.avisPlateforme.groupBy({ by: ["statut"], _count: { _all: true } }),
    prisma.avisPlateforme.findMany({
      where: { statut }, orderBy: { updatedAt: "desc" }, take: 100,
      select: { id: true, statut: true, note: true, texte: true, auteurNom: true, auteurRole: true, ville: true, consentement: true, motifRefus: true, moderePar: true, modereLe: true, updatedAt: true, tenantId: true, tenant: { select: { nomBoutique: true, slug: true, pays: true, planType: true } } },
    }),
    prisma.avisPlateforme.aggregate({ where: { statut: "approuve" }, _avg: { note: true } }),
  ]);
  const nb = (s: string) => compteurs.find((c) => c.statut === s)?._count._all ?? 0;
  const agir = peutAgir(session.role);

  return (
    <div className="space-y-5">
      <EnTetePage eyebrow={t("Gestion")} titre={t("Avis plateforme")}
        sousTitre={<>{t("Avis des marchands sur Axso · publiés sur la landing après validation")}{moyenne._avg.note ? <> · {t("note moyenne publiée")} <strong>{moyenne._avg.note.toLocaleString(t.loc, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}/5</strong></> : null}</>} />
      <Note>{t("Un marchand peut donner son avis après sa première vente payée ou 14 jours sur Axso. Toute modification de sa part remet l'avis en attente. Les témoignages codés en dur de la landing restent affichés après les avis publiés, jusqu'à leur retrait.")}</Note>
      <Onglets actif={statut} onglets={STATUTS.map((s) => ({ id: s.id, nom: t("{0} ({1})", t(s.nom), nb(s.id)), href: `/admin/avis?statut=${s.id}` }))} />
      {!avis.length ? (
        <Carte><EtatVide titre={t(statut === "en_attente" ? "Aucun avis à valider" : "Aucun avis ici")} explication={statut === "en_attente" ? t("Les marchands éligibles voient une carte « Donnez votre avis sur Axso » sur leur tableau de bord.") : undefined} /></Carte>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {avis.map((a) => (
            <Carte key={a.id}
              titre={<span className="flex items-center gap-1" aria-label={t("{0} sur 5", a.note)}>{Array.from({ length: 5 }, (_, i) => <Star key={i} size={14} fill={i < a.note ? "var(--cc-accent)" : "none"} style={{ color: i < a.note ? "var(--cc-accent)" : "var(--cc-text-3)" }} aria-hidden />)}</span>}
              sousTitre={t("Mis à jour le {0}", dateCourte(a.updatedAt.getTime()))}
              actions={a.consentement ? <Badge ton="good">{t("Accord de publication")}</Badge> : <Badge ton="bad">{t("Sans accord")}</Badge>}>
              <p className="text-[13.5px] leading-relaxed whitespace-pre-line">« {a.texte} »</p>
              <p className="text-[12.5px] mt-3"><strong>{a.auteurNom}</strong>{a.auteurRole ? `, ${a.auteurRole}` : ""} · <Link href={`/admin/marchands/${a.tenantId}`} className="hover:underline" style={{ color: "var(--cc-accent-text)" }}>{a.tenant.nomBoutique}</Link> · {a.ville ? `${a.ville}, ` : ""}{t(nomPays(a.tenant.pays))}</p>
              {a.motifRefus && <p className="text-[12px] mt-2 cc-bad">{t("Motif du refus : {0}", a.motifRefus)}</p>}
              {a.moderePar && <p className="text-[11.5px] cc-faint mt-1">{a.modereLe ? t("Décision de {0} le {1}", a.moderePar, dateCourte(a.modereLe.getTime())) : t("Décision de {0}", a.moderePar)}</p>}
              {agir && <div className="mt-3 pt-3 border-t cc-sep"><Moderation id={a.id} statut={a.statut} consentement={a.consentement} /></div>}
            </Carte>
          ))}
        </div>
      )}
    </div>
  );
}
