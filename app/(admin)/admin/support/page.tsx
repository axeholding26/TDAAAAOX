// Support : problèmes signalés par les marchands (« Signaler un problème » du tableau de bord).
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSessionPour } from "@/lib/admin-auth";
import { peutAgir } from "@/lib/command-center/rbac";
import { formats } from "@/lib/command-center/format";
import { getT } from "@/lib/i18n/serveur";
import { STATUTS_SIGNALEMENT, NOM_STATUT } from "@/lib/signalements";
import { EnTetePage, Carte, Badge, EtatVide, Onglets } from "@/components/command-center/ui";
import { Traitement } from "./Traitement";

const TON = { ouvert: "bad", en_cours: "warn", resolu: "good" } as const;

export default async function SupportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const t = await getT();
  const { dateCourte } = formats(t);
  const session = await getAdminSessionPour("support");
  if (!session) redirect("/admin?refus=1");
  const sp = await searchParams;
  const id = typeof sp.id === "string" ? sp.id : null;
  const statut = STATUTS_SIGNALEMENT.find((s) => s === sp.statut) ?? (id ? null : "ouvert");

  const [compteurs, liste] = await Promise.all([
    prisma.signalement.groupBy({ by: ["statut"], _count: { _all: true } }),
    prisma.signalement.findMany({
      where: id ? { id } : { statut: statut! }, orderBy: { createdAt: "desc" }, take: 100,
      include: { tenant: { select: { nomBoutique: true, slug: true } } },
    }),
  ]);
  const auteurs = new Map((await prisma.user.findMany({ where: { id: { in: liste.flatMap((s) => (s.userId ? [s.userId] : [])) } }, select: { id: true, name: true, email: true } })).map((u) => [u.id, u]));
  const nb = (s: string) => compteurs.find((c) => c.statut === s)?._count._all ?? 0;
  const agir = peutAgir(session.role);

  return (
    <div className="space-y-5">
      <EnTetePage eyebrow={t("Gestion")} titre={t("Support")} sousTitre={t("Problèmes signalés par les marchands depuis leur tableau de bord")} />
      <Onglets actif={statut ?? ""} onglets={STATUTS_SIGNALEMENT.map((s) => ({ id: s, nom: t("{0} ({1})", t(NOM_STATUT[s]), nb(s)), href: `/admin/support?statut=${s}` }))} />
      {!liste.length ? (
        <Carte><EtatVide titre={t(id ? "Signalement introuvable" : "Aucun signalement ici")} /></Carte>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {liste.map((s) => {
            const a = s.userId ? auteurs.get(s.userId) : null;
            const st = s.statut as keyof typeof TON;
            return (
              <Carte key={s.id}
                titre={<Link href={`/admin/marchands/${s.tenantId}`} className="hover:underline">{s.tenant.nomBoutique}</Link>}
                sousTitre={t("Signalé le {0}", dateCourte(s.createdAt.getTime()))}
                actions={<Badge ton={TON[st] ?? "neutre"}>{t(NOM_STATUT[st] ?? s.statut)}</Badge>}>
                <p className="text-[13.5px] leading-relaxed whitespace-pre-line break-words">{s.description}</p>
                {s.capture && (
                  <a href={s.capture} target="_blank" rel="noopener noreferrer" className="block mt-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.capture} alt={t("Capture d'écran")} className="max-h-64 rounded-lg border cc-sep" />
                  </a>
                )}
                <dl className="text-[12px] mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <dt className="cc-faint">{t("Auteur")}</dt><dd className="break-words">{a ? [a.name, a.email].filter(Boolean).join(" · ") : "—"}</dd>
                  <dt className="cc-faint">{t("Page")}</dt><dd className="font-mono break-all">{s.page}</dd>
                  <dt className="cc-faint">{t("Appareil")}</dt><dd className="break-words">{s.appareil ?? "—"}</dd>
                  {s.erreur && <><dt className="cc-faint">{t("Erreur")}</dt><dd className="font-mono break-all cc-bad">{s.erreur}</dd></>}
                </dl>
                {s.reponse && <p className="text-[12.5px] mt-3 whitespace-pre-line"><span className="cc-faint">{t("Réponse de {0} :", s.reponduPar ?? "Axso")} </span>{s.reponse}</p>}
                {agir && <div className="mt-3 pt-3 border-t cc-sep"><Traitement id={s.id} statut={s.statut} reponse={s.reponse ?? ""} /></div>}
              </Carte>
            );
          })}
        </div>
      )}
    </div>
  );
}
