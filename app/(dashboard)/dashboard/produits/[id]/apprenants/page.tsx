import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Users, PlayCircle, CheckCircle2, Award, HelpCircle, UserX, PenLine } from "lucide-react";
import { auth } from "@/lib/auth";
import { exigerModule } from "@/lib/permissions-server";
import { prisma } from "@/lib/prisma";
import { getT } from "@/lib/i18n/serveur";
import { PAIEMENT } from "@/lib/commandes";
import { cleApprenant, estVisible, etatApprenant, JOURS_ABANDON } from "@/lib/formation/regles";
import { CorrectionDevoir, RevocationCertificat } from "@/components/dashboard/FormationSuivi";

const ETATS: Record<string, { label: string; color: string }> = {
  termine: { label: "Terminé", color: "#16a34a" },
  en_cours: { label: "En cours", color: "#2563eb" },
  non_demarre: { label: "Pas démarré", color: "#6b7280" },
  abandon: { label: "Abandon", color: "#dc2626" },
};

// Suivi d'une formation : statistiques, devoirs à corriger, apprenants, attestations.
// Uniquement les apprenants de CETTE boutique (produit filtré par tenantId).
export default async function ApprenantsFormationPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getT();
  const session = await auth();
  if (!session) redirect("/connexion");
  await exigerModule(session, "produits");
  const tenantId = (session.user as any)?.tenantId as string | undefined;
  if (!tenantId) redirect("/connexion");
  const { id } = await params;

  const produit = await prisma.produit.findFirst({
    where: { id, tenantId, type: "formation" },
    select: {
      id: true, nom: true,
      formation: { select: { certif: true, chapitres: { select: { actif: true, statut: true, lecons: { select: { id: true, titre: true, type: true, actif: true, statut: true } } } } } },
    },
  });
  if (!produit?.formation) notFound();

  const lecons = produit.formation.chapitres.filter(estVisible).flatMap((c) => c.lecons.filter(estVisible));
  const leconIds = lecons.map((l) => l.id);
  const titreLecon = new Map(lecons.map((l) => [l.id, l.titre]));
  const quizIds = lecons.filter((l) => l.type === "quiz").map((l) => l.id);

  const acces = await prisma.accesFormation.findMany({ where: { produitId: id }, orderBy: { createdAt: "asc" }, take: 2000 });
  const commandes = await prisma.commande.findMany({
    where: { id: { in: acces.map((a) => a.commandeId) }, tenantId },
    select: { id: true, clientNom: true, paiementStatut: true, statut: true },
  });
  const cmd = new Map(commandes.map((c) => [c.id, c]));
  // Inscrits : accès payé non remboursé ; un apprenant qui a acheté deux fois compte une fois.
  const inscrits = new Map<string, { nom: string; email: string; inscritLe: Date; activite: Date }>();
  for (const a of acces) {
    const c = cmd.get(a.commandeId);
    if (!c || a.revoqueAt || c.paiementStatut !== PAIEMENT.PAYE || c.statut === "annulee") continue;
    const cle = cleApprenant(a);
    const act = a.derniereActiviteAt ?? a.createdAt;
    const deja = inscrits.get(cle);
    if (deja) { if (act > deja.activite) deja.activite = act; continue; }
    inscrits.set(cle, { nom: c.clientNom, email: a.clientEmail, inscritLe: a.createdAt, activite: act });
  }
  const cles = [...inscrits.keys()];

  const [progressions, tentatives, devoirs, certificats] = await Promise.all([
    leconIds.length && cles.length ? prisma.progressionLecon.findMany({ where: { leconId: { in: leconIds }, clientEmail: { in: cles }, complete: true }, select: { leconId: true, clientEmail: true } }) : [],
    prisma.tentativeQuiz.groupBy({ by: ["apprenant", "leconId"], where: { produitId: id }, _count: true }),
    prisma.renduDevoir.findMany({ where: { produitId: id }, orderBy: { updatedAt: "desc" }, take: 500 }),
    prisma.certificat.findMany({ where: { produitId: id, tenantId }, orderBy: { delivreAt: "desc" } }),
  ]);
  const quizOk = new Map<string, number>(); // apprenant → quiz réussis
  const reussis = await prisma.tentativeQuiz.findMany({ where: { produitId: id, reussi: true }, select: { apprenant: true, leconId: true }, distinct: ["apprenant", "leconId"] });
  for (const r of reussis) quizOk.set(r.apprenant, (quizOk.get(r.apprenant) ?? 0) + 1);
  const faites = new Map<string, number>();
  for (const p of progressions) faites.set(p.clientEmail, (faites.get(p.clientEmail) ?? 0) + 1);
  const certParApprenant = new Map(certificats.map((c) => [c.apprenant, c]));

  const lignes = cles.map((cle) => {
    const i = inscrits.get(cle)!;
    const pct = leconIds.length ? Math.round(((faites.get(cle) ?? 0) / leconIds.length) * 100) : 0;
    return { cle, ...i, pct, etat: etatApprenant({ pct, derniereActivite: i.activite }), quiz: quizOk.get(cle) ?? 0, certificat: certParApprenant.get(cle) };
  });
  const nb = (e: string) => lignes.filter((l) => l.etat === e).length;
  const demarres = lignes.filter((l) => l.pct > 0).length;
  const quizTentes = tentatives.filter((x) => quizIds.includes(x.leconId)).length;
  const quizReussisTotal = reussis.filter((x) => quizIds.includes(x.leconId)).length;
  const taux = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : "—");
  const aCorriger = devoirs.filter((d) => d.statut === "soumis");
  const nomDe = (cle: string) => inscrits.get(cle)?.nom ?? cle;

  const stats = [
    { Icon: Users, label: "Inscrits", valeur: String(lignes.length), def: "Accès payé, non remboursé" },
    { Icon: PlayCircle, label: "Démarrés", valeur: `${demarres} · ${taux(demarres, lignes.length)}`, def: "Au moins une leçon terminée (progression)" },
    { Icon: CheckCircle2, label: "Terminés", valeur: `${nb("termine")} · ${taux(nb("termine"), lignes.length)}`, def: "100 % des leçons publiées terminées (complétion)" },
    { Icon: HelpCircle, label: "Réussite aux quiz", valeur: taux(quizReussisTotal, quizTentes), def: "Quiz tentés où la note minimale a été atteinte (réussite)" },
    { Icon: UserX, label: "Abandons", valeur: `${nb("abandon")} · ${taux(nb("abandon"), lignes.length)}`, def: `Non terminé et inactif depuis ${JOURS_ABANDON} jours` },
    { Icon: Award, label: "Attestations", valeur: String(certificats.filter((c) => !c.revoqueAt).length), def: produit.formation.certif ? "Délivrées automatiquement, non révoquées" : "Attestation désactivée pour cette formation" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div>
        <Link href={`/dashboard/produits/${id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-3"><ArrowLeft size={14} />{" "}{t("Retour à la formation")}</Link>
        <h1 className="text-xl font-bold text-gray-900">{t("Suivi des apprenants")} — {produit.nom}</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {stats.map(({ Icon, label, valeur, def }) => (
          <div key={label} className="bg-white border border-gray-100 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-gray-500 text-xs"><Icon size={14} className="text-[#F5A623]" />{t(label)}</div>
            <p className="text-xl font-bold text-gray-900 mt-1">{valeur}</p>
            <p className="text-[11px] text-gray-400 mt-1">{t(def)}</p>
          </div>
        ))}
      </div>

      <section id="devoirs" className="bg-white border border-gray-100 rounded-2xl p-5">
        <h2 className="text-[13px] font-semibold text-gray-900 flex items-center gap-2 mb-3"><PenLine size={14} className="text-[#F5A623]" />{t("Devoirs à corriger")} ({aCorriger.length})</h2>
        {aCorriger.length === 0 ? <p className="text-sm text-gray-400">{t("Aucun devoir en attente.")}</p> : (
          <div className="space-y-3">
            {aCorriger.map((d) => (
              <CorrectionDevoir key={d.id} produitId={id} rendu={{ id: d.id, texte: d.texte, apprenant: nomDe(d.apprenant), lecon: titreLecon.get(d.leconId) ?? "—", date: d.updatedAt.toISOString() }} />
            ))}
          </div>
        )}
        {devoirs.length > aCorriger.length && (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-gray-500">{t("Devoirs déjà corrigés")} ({devoirs.length - aCorriger.length})</summary>
            <ul className="mt-2 space-y-1 text-gray-600">
              {devoirs.filter((d) => d.statut !== "soumis").map((d) => (
                <li key={d.id}>{nomDe(d.apprenant)} · {titreLecon.get(d.leconId) ?? "—"} · <b className={d.statut === "valide" ? "text-emerald-600" : "text-red-600"}>{d.statut === "valide" ? t("Validé") : t("À reprendre")}</b>{d.note != null ? ` · ${d.note}/100` : ""}</li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="bg-white border border-gray-100 rounded-2xl p-5 overflow-x-auto">
        <h2 className="text-[13px] font-semibold text-gray-900 mb-3">{t("Apprenants")} ({lignes.length})</h2>
        {lignes.length === 0 ? <p className="text-sm text-gray-400">{t("Aucun apprenant pour l'instant : l'inscription se fait automatiquement après un paiement confirmé.")}</p> : (
          <table className="w-full text-sm min-w-[640px]">
            <thead><tr className="text-left text-xs text-gray-400">
              <th className="py-2 font-medium">{t("Apprenant")}</th><th className="font-medium">{t("Inscrit le")}</th><th className="font-medium">{t("Progression")}</th>
              <th className="font-medium">{t("Quiz réussis")}</th><th className="font-medium">{t("Dernière activité")}</th><th className="font-medium">{t("État")}</th>
            </tr></thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.cle} className="border-t border-gray-50">
                  <td className="py-2"><p className="font-medium text-gray-900">{l.nom}</p><p className="text-xs text-gray-400">{l.email || t("sans e-mail")}</p></td>
                  <td className="text-gray-600">{l.inscritLe.toLocaleDateString("fr-FR")}</td>
                  <td><div className="flex items-center gap-2"><div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-[#F5A623]" style={{ width: `${l.pct}%` }} /></div><span className="text-xs text-gray-600">{l.pct} %</span></div></td>
                  <td className="text-gray-600">{l.quiz}/{quizIds.length}</td>
                  <td className="text-gray-600">{l.activite.toLocaleDateString("fr-FR")}</td>
                  <td><span className="text-xs font-semibold" style={{ color: ETATS[l.etat].color }}>{t(ETATS[l.etat].label)}</span>{l.certificat && !l.certificat.revoqueAt && <Award size={12} className="inline ml-1 text-[#F5A623]" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="bg-white border border-gray-100 rounded-2xl p-5">
        <h2 className="text-[13px] font-semibold text-gray-900 mb-1">{t("Attestations délivrées")} ({certificats.length})</h2>
        <p className="text-[11px] text-gray-400 mb-3">{t("Attestations internes (pas un diplôme accrédité). Chaque révocation est enregistrée avec sa date, son motif et son auteur.")}</p>
        {certificats.length === 0 ? <p className="text-sm text-gray-400">{t("Aucune attestation pour l'instant.")}</p> : (
          <div className="space-y-2">
            {certificats.map((c) => (
              <RevocationCertificat key={c.id} produitId={id} certificat={{ id: c.id, code: c.code, nom: c.nom, delivreAt: c.delivreAt.toISOString(), revoqueAt: c.revoqueAt?.toISOString() ?? null, revoqueMotif: c.revoqueMotif }} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
