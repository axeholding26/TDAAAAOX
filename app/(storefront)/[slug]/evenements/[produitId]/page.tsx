export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { CalendarDays, Users, Video } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { boutiqueVisible } from "@/lib/tenant";
import { resolveConfigVitrine } from "@/lib/vitrine-design";
import { prixClient } from "@/lib/pricing";
import { getT } from "@/lib/i18n/serveur";
import { refusVenteLive } from "@/lib/live/service";
import { formaterDate, placesRestantes, seances, LIBELLE_TYPE } from "@/lib/live/regles";
import { InscriptionLive } from "@/components/live/LiveVitrine";

interface Props { params: Promise<{ slug: string; produitId: string }> }

export async function generateMetadata({ params }: Props) {
  const { produitId } = await params;
  const p = await prisma.produit.findUnique({ where: { id: produitId }, select: { nom: true, description: true, images: true } });
  return p ? { title: p.nom, description: p.description ?? "", openGraph: { title: p.nom, images: p.images.slice(0, 1) } } : { title: "Événement" };
}

// Page publique d'un événement live ou d'un bootcamp : date dans son fuseau, intervenants,
// places restantes, inscription gratuite ou paiement via le checkout existant. Jamais de lien de salle ici.
export default async function EvenementPage({ params }: Props) {
  const { slug, produitId } = await params;
  const t = await getT();
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant || !(await boutiqueVisible(tenant))) notFound();
  const produit = await prisma.produit.findFirst({
    where: { id: produitId, tenantId: tenant.id, actif: true, type: { in: ["evenement", "bootcamp"] } },
    include: { evenement: true, bootcamp: { include: { sessions: { where: { statut: { not: "annule" } }, orderBy: { debut: "asc" }, select: { titre: true, debut: true, dureeMin: true } }, missions: { select: { id: true } } } } },
  });
  if (!produit || (!produit.evenement && !produit.bootcamp)) notFound();
  const { colors: c } = await resolveConfigVitrine(tenant.themeId, tenant.id, tenant.themeConfig as Record<string, any>);
  const ev = produit.evenement, bc = produit.bootcamp;
  const prix = produit.prix > 0 ? prixClient(produit.prix, tenant.commissionRate ?? 0.1, produit.type) : 0;
  const cible = ev ?? bc!;
  const restantes = placesRestantes(cible.capacite, cible.placesPrises);
  const refus = await refusVenteLive(produit.id, produit.prix > 0 ? produit.prix : 1);
  const fermeture = refus === "complet" ? "Complet : plus aucune place disponible" : refus ? `Inscriptions fermées : ${refus}` : null;
  const intervenants = (ev?.intervenants ?? []) as { nom: string; role?: string }[];

  return (
    <div style={{ backgroundColor: c.fond, color: c.texte, minHeight: "100vh" }}>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <a href={`/${slug}`} className="text-sm opacity-60">← {tenant.nomBoutique}</a>
        {produit.images[0] && <img src={produit.images[0]} alt="" className="w-full aspect-video object-cover rounded-2xl" />}
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: c.accent }}>{t(ev ? LIBELLE_TYPE[ev.type] ?? "Événement" : "Bootcamp")}{bc?.cohorte ? ` · ${bc.cohorte}` : ""}</p>
          <h1 className="text-2xl sm:text-3xl font-bold">{produit.nom}</h1>
          {ev?.statut === "annule" && <p className="text-red-600 font-semibold">{t("Événement annulé")}{ev.raisonAnnulation ? ` : ${ev.raisonAnnulation}` : ""}</p>}
        </div>
        <div className="grid gap-2 text-sm">
          <p className="flex items-start gap-2"><CalendarDays size={16} className="mt-0.5 shrink-0" />
            {ev ? seances(ev).map((d) => formaterDate(d, ev.fuseau)).join(" · ") + ` (${ev.dureeMin} min)` : `${formaterDate(bc!.dateDebut, bc!.fuseau)} → ${formaterDate(bc!.dateFin, bc!.fuseau)}`}
          </p>
          <p className="flex items-center gap-2"><Video size={16} />{t("En ligne — le lien de connexion personnel est révélé aux inscrits avant le début")}</p>
          {restantes !== null && <p className="flex items-center gap-2"><Users size={16} />{restantes} {t("place(s) restante(s)")}</p>}
        </div>
        {intervenants.length > 0 && (
          <div className="text-sm"><p className="font-semibold mb-1">{t("Intervenants")}</p>{intervenants.map((i, k) => <p key={k}>{i.nom}{i.role ? ` — ${i.role}` : ""}</p>)}</div>
        )}
        {produit.description && <p className="whitespace-pre-wrap text-[15px] leading-relaxed opacity-90">{produit.description}</p>}
        {bc && bc.sessions.length > 0 && (
          <div className="text-sm"><p className="font-semibold mb-1">{t("Programme")} · {bc.sessions.length} {t("séances")} · {bc.missions.length} {t("missions")}</p>
            {bc.sessions.map((s, k) => <p key={k} className="opacity-80">{formaterDate(s.debut, bc.fuseau)} — {s.titre}</p>)}
          </div>
        )}
        {(ev?.certificat || bc?.certificat) && <p className="text-sm opacity-80">{t(bc ? `Attestation délivrée avec au moins ${bc.seuilPresence} % de présence et ${bc.seuilMissions} % de missions validées.` : "Attestation de participation délivrée aux participants présents.")}</p>}
        <InscriptionLive slug={slug} tenantId={tenant.id} produitId={produit.id} prix={prix} devise={tenant.devise} accent={c.accent} fermeture={fermeture} />
      </div>
    </div>
  );
}
