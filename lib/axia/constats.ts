// Prises de parole d'AXIA : constats calculés sur les données réelles de la
// boutique (jamais par l'IA), puis reformulés en 1-2 phrases dans le style du
// marchand. Lancé au plus toutes les 15 min par boutique, quand un marchand a
// le dashboard ouvert (app/api/axia/propositions) — pas besoin de cron.
import { prisma } from "@/lib/prisma";
import { completionAuto } from "@/lib/llm-client";
import { calculerProgression } from "@/lib/objectifs";
import { lireStyle, rafraichirStyle, consigneStyle } from "./style";

const JOUR = 86_400_000;
const MAX_PAR_JOUR = 4; // au-delà, AXIA devient du bruit
const il_y_a = (jours: number) => new Date(Date.now() - jours * JOUR);
const jourCle = () => new Date().toISOString().slice(0, 10);
const semaineCle = () => Math.floor(Date.now() / (7 * JOUR));

type Action = { prompt: string } | { lien: string; libelle: string };
interface Constat {
  type: string;
  cle: string;
  priorite: number;
  texte: string; // message par défaut (si l'IA est indisponible)
  action?: Action;
  cooldownJours?: number; // pas deux constats de ce type dans cet intervalle
}
interface Ctx {
  tenantId: string;
  devise: string;
  statut: string;
  planExpiresAt: Date | null;
  fmt: (n: number) => string;
}

// ─── Ventes : hausse / baisse sur 7 jours, avec causes probables ─────────────

async function caPeriode(tenantId: string, de: number, a: number) {
  const r = await prisma.commande.aggregate({
    where: { tenantId, paiementStatut: "completed", createdAt: { gte: il_y_a(de), lt: il_y_a(a) } },
    _sum: { montantTotal: true },
    _count: true,
  });
  return { ca: r._sum.montantTotal ?? 0, nb: r._count };
}

async function ventesParProduit(tenantId: string, de: number, a: number) {
  const lignes = await prisma.ligneCommande.groupBy({
    by: ["produitId"],
    where: { commande: { is: { tenantId, paiementStatut: "completed", createdAt: { gte: il_y_a(de), lt: il_y_a(a) } } } },
    _sum: { quantite: true },
  });
  return new Map(lignes.map((l) => [l.produitId, l._sum.quantite ?? 0]));
}

async function visites(tenantId: string, de: number, a: number) {
  const r = await prisma.analytics.aggregate({
    where: { tenantId, type: "page_view", date: { gte: il_y_a(de), lt: il_y_a(a) } },
    _sum: { valeur: true },
  });
  return r._sum.valeur ?? 0;
}

async function causesBaisse(ctx: Ctx): Promise<string[]> {
  const { tenantId } = ctx;
  const causes: string[] = [];
  const [vNow, vAvant, pNow, pAvant, promosFinies] = await Promise.all([
    visites(tenantId, 7, 0),
    visites(tenantId, 14, 7),
    ventesParProduit(tenantId, 7, 0),
    ventesParProduit(tenantId, 14, 7),
    prisma.codePromo.findMany({
      where: { tenantId, utilisations: { gt: 0 }, dateExpiration: { gte: il_y_a(14), lt: new Date() } },
      select: { code: true },
      take: 2,
    }),
  ]);

  if (vAvant >= 20 && vNow < vAvant * 0.85) {
    causes.push(`les visites ont baissé de ${Math.round((1 - vNow / vAvant) * 100)} % (${vNow} contre ${vAvant})`);
  } else if (vAvant >= 20 && vNow >= vAvant * 0.9) {
    causes.push("les visites sont stables : les visiteurs achètent moins (prix, confiance ou fiches produits à revoir)");
  }

  const reculs = [...pAvant.entries()]
    .map(([id, q]) => ({ id, perte: q - (pNow.get(id) ?? 0) }))
    .filter((p) => p.perte > 0)
    .sort((a, b) => b.perte - a.perte)
    .slice(0, 2);
  if (reculs.length) {
    const produits = await prisma.produit.findMany({ where: { id: { in: reculs.map((r) => r.id) } }, select: { id: true, nom: true, stock: true, type: true, actif: true } });
    for (const r of reculs) {
      const p = produits.find((x) => x.id === r.id);
      if (!p) continue;
      if (!p.actif) causes.push(`« ${p.nom} », qui se vendait bien, est désactivé`);
      else if (p.type === "physique" && p.stock <= 0) causes.push(`« ${p.nom} », qui se vendait bien, est en rupture de stock`);
      else causes.push(`« ${p.nom} » s'est moins vendu (${r.perte} ventes de moins)`);
    }
  }

  if (promosFinies.length) causes.push(`le code promo ${promosFinies.map((p) => p.code).join(", ")} a expiré`);
  return causes;
}

async function ventes(ctx: Ctx): Promise<Constat | null> {
  const [cette, avant] = await Promise.all([caPeriode(ctx.tenantId, 7, 0), caPeriode(ctx.tenantId, 14, 7)]);
  if (avant.ca <= 0 || Math.max(cette.nb, avant.nb) < 3) return null;
  const variation = Math.round(((cette.ca - avant.ca) / avant.ca) * 100);
  if (Math.abs(variation) < 15) return null;
  const chiffres = `${ctx.fmt(cette.ca)} contre ${ctx.fmt(avant.ca)} la semaine d'avant`;

  if (variation > 0) {
    return {
      type: "ventes_hausse", cle: `ventes:${semaineCle()}`, priorite: 6,
      texte: `Tes ventes ont monté de ${variation} % cette semaine, bravo ! ${chiffres}.`,
      action: { prompt: `Mes ventes ont monté de ${variation} % cette semaine (${chiffres}). Qu'est-ce qui a marché, et comment en profiter encore plus ?` },
    };
  }
  const causes = await causesBaisse(ctx);
  return {
    type: "ventes_baisse", cle: `ventes:${semaineCle()}`, priorite: 9,
    texte: `Tes ventes ont baissé de ${-variation} % cette semaine (${chiffres})${causes.length ? `, surtout parce que ${causes.slice(0, 2).join(" et ")}` : ""}. Je te propose une stratégie pour remonter ?`,
    action: { prompt: `Mes ventes ont baissé de ${-variation} % cette semaine (${chiffres}). Causes repérées : ${causes.join(" ; ") || "aucune évidente"}. Analyse mes données et propose-moi une stratégie marketing concrète pour remonter.` },
  };
}

// ─── Produits ────────────────────────────────────────────────────────────────

async function stockBas(ctx: Ctx): Promise<Constat | null> {
  const produits = await prisma.produit.findMany({
    where: { tenantId: ctx.tenantId, actif: true, type: "physique", stock: { lte: 10 } },
    select: { id: true, nom: true, stock: true, stockMin: true },
    take: 100,
  });
  if (!produits.length) return null;
  const ventes30 = await ventesParProduit(ctx.tenantId, 30, 0);
  const alertes = produits
    .map((p) => {
      const parJour = (ventes30.get(p.id) ?? 0) / 30;
      const jours = parJour > 0 ? Math.floor(p.stock / parJour) : Infinity;
      return { ...p, jours, vendu: parJour > 0 };
    })
    .filter((p) => (p.vendu && p.jours <= 7) || (p.stockMin != null && p.stock <= p.stockMin))
    .sort((a, b) => a.jours - b.jours)
    .slice(0, 3);
  if (!alertes.length) return null;
  const liste = alertes.map((p) => p.stock <= 0 ? `« ${p.nom} » est en rupture` : `« ${p.nom} » : plus que ${p.stock}${p.jours !== Infinity ? ` (~${p.jours} j de ventes)` : ""}`);
  return {
    type: "stock_bas", cle: `stock:${jourCle()}`, priorite: 8, cooldownJours: 3,
    texte: `Stock bientôt épuisé — ${liste.join(", ")}. On prévoit le réassort ?`,
    action: { prompt: `Ces produits sont bientôt en rupture : ${liste.join(" ; ")}. Propose-moi quoi faire (réassort, fournisseur, mise en avant d'une alternative).` },
  };
}

async function topFlop(ctx: Ctx): Promise<Constat | null> {
  const [ventes7, flops] = await Promise.all([
    ventesParProduit(ctx.tenantId, 7, 0),
    prisma.produit.findMany({ where: { tenantId: ctx.tenantId, actif: true, vues: { gte: 50 } }, select: { nom: true, vues: true, ventes: true }, orderBy: { vues: "desc" }, take: 20 }),
  ]);
  const [topId, topQ] = [...ventes7.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  const top = topId ? await prisma.produit.findUnique({ where: { id: topId }, select: { nom: true } }) : null;
  const flop = flops.find((p) => p.ventes / p.vues < 0.01);
  if (!top && !flop) return null;
  const phrases = [
    top && `Ton produit star cette semaine : « ${top.nom} » (${topQ} ventes).`,
    flop && `« ${flop.nom} » est très vu (${flop.vues} vues) mais peu acheté : prix ou photos à revoir ?`,
  ].filter(Boolean);
  return {
    type: "produits_top_flop", cle: `topflop:${semaineCle()}`, priorite: 4,
    texte: phrases.join(" "),
    action: flop
      ? { prompt: `« ${flop.nom} » a ${flop.vues} vues mais seulement ${flop.ventes} ventes. Analyse sa fiche et propose des améliorations (prix, photos, description).` }
      : { prompt: `« ${top!.nom} » est mon produit star cette semaine. Comment en profiter davantage ?` },
  };
}

async function fichesIncompletes(ctx: Ctx): Promise<Constat | null> {
  const n = await prisma.produit.count({
    where: { tenantId: ctx.tenantId, actif: true, OR: [{ images: { isEmpty: true } }, { description: null }, { description: "" }] },
  });
  if (!n) return null;
  return {
    type: "fiches_incompletes", cle: `fiches:${jourCle()}`, priorite: 3, cooldownJours: 14,
    texte: `${n} produit${n > 1 ? "s" : ""} sans photo ou sans description. Une fiche complète vend beaucoup mieux.`,
    action: { prompt: "Liste mes produits sans photo ou sans description et aide-moi à compléter leurs fiches." },
  };
}

// ─── Clients et commandes ────────────────────────────────────────────────────

async function paiementsNonFinalises(ctx: Ctx): Promise<Constat | null> {
  const commandes = await prisma.commande.findMany({
    where: {
      tenantId: ctx.tenantId, paiementStatut: "pending", statut: { not: "annulee" },
      methodePaiement: { not: { contains: "cod" } },
      createdAt: { gte: il_y_a(3), lt: new Date(Date.now() - 2 * 3_600_000) },
    },
    select: { numero: true, clientNom: true, clientTelephone: true, clientEmail: true, montantTotal: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  if (!commandes.length) return null;
  const n = commandes.length;
  return {
    type: "relance_paiements", cle: `relance:${jourCle()}`, priorite: 8, cooldownJours: 2,
    texte: `${n} client${n > 1 ? "s n'ont" : " n'a"} pas finalisé ${n > 1 ? "leur" : "son"} paiement (${commandes.slice(0, 3).map((c) => c.clientNom).join(", ")}). Je ${n > 1 ? "les" : "le"} relance ?`,
    action: { prompt: `Relance les clients qui n'ont pas finalisé le paiement de leur commande : ${commandes.map((c) => `${c.numero} — ${c.clientNom} — ${c.clientTelephone || c.clientEmail} — ${ctx.fmt(c.montantTotal)}`).join(" ; ")}. Prépare un message court et personnalisé pour chacun.` },
  };
}

async function commandesBloquees(ctx: Ctx): Promise<Constat | null> {
  const n = await prisma.commande.count({
    where: { tenantId: ctx.tenantId, statut: { in: ["en_attente", "confirmee", "en_preparation"] }, updatedAt: { lt: il_y_a(2) }, createdAt: { gte: il_y_a(30) } },
  });
  if (!n) return null;
  return {
    type: "commandes_bloquees", cle: `bloquees:${jourCle()}`, priorite: 8, cooldownJours: 1,
    texte: `${n} commande${n > 1 ? "s n'ont" : " n'a"} pas bougé depuis plus de 2 jours. Tes clients attendent.`,
    action: { lien: "/dashboard/commandes", libelle: "Voir les commandes" },
  };
}

async function clientsInactifs(ctx: Ctx): Promise<Constat | null> {
  const clients = await prisma.client.findMany({
    where: { tenantId: ctx.tenantId, totalCommandes: { gte: 2 }, commandes: { none: { createdAt: { gte: il_y_a(60) } } } },
    select: { nom: true },
    orderBy: { totalDepense: "desc" },
    take: 50,
  });
  if (clients.length < 5) return null;
  return {
    type: "clients_inactifs", cle: `inactifs:${jourCle()}`, priorite: 5, cooldownJours: 14,
    texte: `${clients.length} bons clients n'ont rien acheté depuis 2 mois. On leur envoie une offre pour les faire revenir ?`,
    action: { prompt: `Propose une campagne pour réactiver mes ${clients.length} clients fidèles qui n'ont rien acheté depuis 60 jours (dont ${clients.slice(0, 5).map((c) => c.nom).join(", ")}), avec le message et l'offre.` },
  };
}

async function avisNegatifs(ctx: Ctx): Promise<Constat | null> {
  const avis = await prisma.avis.findMany({
    where: { tenantId: ctx.tenantId, note: { lte: 2 }, createdAt: { gte: il_y_a(7) } },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  if (!avis.length) return null;
  return {
    type: "avis_negatifs", cle: `avis:${avis[0].id}`, priorite: 6, cooldownJours: 3,
    texte: `${avis.length} avis négatif${avis.length > 1 ? "s" : ""} cette semaine. Une réponse rapide rassure les prochains acheteurs.`,
    action: { lien: "/dashboard/avis", libelle: "Voir les avis" },
  };
}

async function messagesSansReponse(ctx: Ctx): Promise<Constat | null> {
  const n = await prisma.messageRecu.count({
    where: { tenantId: ctx.tenantId, direction: "entrant", repondu: false, createdAt: { gte: il_y_a(3), lt: new Date(Date.now() - 3 * 3_600_000) } },
  });
  if (!n) return null;
  return {
    type: "messages_sans_reponse", cle: `messages:${jourCle()}`, priorite: 7, cooldownJours: 1,
    texte: `${n} message${n > 1 ? "s" : ""} client sans réponse depuis plus de 3 heures.`,
    action: { lien: "/dashboard/messages", libelle: "Répondre" },
  };
}

// ─── Objectifs, abonnement, boutique, rappels ────────────────────────────────

async function objectifs(ctx: Ctx): Promise<Constat | null> {
  const goals = await prisma.agentGoal.findMany({ where: { tenantId: ctx.tenantId, statut: "actif", deadline: { gt: new Date() } }, take: 5 });
  for (const g of goals) {
    const actuel = await calculerProgression({ tenantId: ctx.tenantId, type: g.type, depuis: g.createdAt });
    const ratio = g.cible > 0 ? actuel / g.cible : 0;
    const temps = (Date.now() - g.createdAt.getTime()) / (g.deadline.getTime() - g.createdAt.getTime());
    if (ratio >= 1) {
      return { type: "objectif_atteint", cle: `objectif:${g.id}:atteint`, priorite: 7, texte: `Objectif « ${g.titre} » atteint, bravo ! 🎉` };
    }
    if (temps >= 0.3 && ratio < temps - 0.2) {
      const pct = Math.round(ratio * 100), pctTemps = Math.round(temps * 100);
      return {
        type: "objectif_retard", cle: `objectif:${g.id}:${semaineCle()}`, priorite: 6,
        texte: `Objectif « ${g.titre} » : ${pct} % atteint alors que ${pctTemps} % du temps est passé. On accélère ?`,
        action: { prompt: `Mon objectif « ${g.titre} » est à ${pct} % alors que ${pctTemps} % du temps est écoulé (échéance le ${g.deadline.toLocaleDateString("fr-FR")}). Propose un plan d'action pour le rattraper.` },
      };
    }
  }
  return null;
}

async function abonnement(ctx: Ctx): Promise<Constat | null> {
  if (!ctx.planExpiresAt) return null;
  const jours = Math.ceil((ctx.planExpiresAt.getTime() - Date.now()) / JOUR);
  if (jours <= 0 || jours > 7) return null;
  return {
    type: "abonnement_expire", cle: `abonnement:${ctx.planExpiresAt.toISOString().slice(0, 10)}:${jours <= 2 ? "j2" : "j7"}`, priorite: 7,
    texte: `Ton abonnement expire dans ${jours} jour${jours > 1 ? "s" : ""}. Pense à le renouveler pour garder toutes tes fonctionnalités.`,
    action: { lien: "/dashboard/abonnement", libelle: "Renouveler" },
  };
}

async function boutiqueBrouillon(ctx: Ctx): Promise<Constat | null> {
  if (ctx.statut !== "brouillon") return null;
  return {
    type: "boutique_brouillon", cle: `brouillon:${jourCle()}`, priorite: 6, cooldownJours: 3,
    texte: "Ta boutique n'est pas encore publiée : tes clients ne peuvent pas la voir.",
    action: { prompt: "Vérifie ce qui manque pour publier ma boutique et publie-la si tout est prêt." },
  };
}

async function rappels(ctx: Ctx): Promise<Constat | null> {
  const [posts, promo] = await Promise.all([
    prisma.postPlanifie.count({ where: { tenantId: ctx.tenantId, statut: "planifie", planifieLe: { gte: new Date(), lt: new Date(Date.now() + JOUR) } } }),
    prisma.codePromo.findFirst({ where: { tenantId: ctx.tenantId, actif: true, dateExpiration: { gte: new Date(), lt: new Date(Date.now() + 3 * JOUR) } }, select: { id: true, code: true, dateExpiration: true } }),
  ]);
  if (promo) {
    return {
      type: "rappel_promo", cle: `promo:${promo.id}`, priorite: 5,
      texte: `Rappel : le code promo ${promo.code} expire le ${promo.dateExpiration!.toLocaleDateString("fr-FR")}. On le prolonge ou on prépare la suite ?`,
      action: { lien: "/dashboard/marketing/codes-promo", libelle: "Voir les codes" },
    };
  }
  if (posts) {
    return {
      type: "rappel_publications", cle: `posts:${jourCle()}`, priorite: 5,
      texte: `Rappel : ${posts} publication${posts > 1 ? "s programmées partent" : " programmée part"} dans les prochaines 24 h.`,
      action: { lien: "/dashboard/scheduler", libelle: "Vérifier" },
    };
  }
  return null;
}

// ponytail: dates des fêtes musulmanes (Korité, Tabaski) approximées à ±1 jour, à compléter au-delà de 2028
const FETES_VARIABLES = [
  { nom: "La Korité", date: "2027-03-10" }, { nom: "La Tabaski", date: "2027-05-16" },
  { nom: "La Korité", date: "2028-02-27" }, { nom: "La Tabaski", date: "2028-05-05" },
];
function prochainesFetes(): { nom: string; date: Date }[] {
  const an = new Date().getFullYear();
  const blackFriday = (a: number) => { const d = new Date(a, 10, 1); d.setDate(1 + ((5 - d.getDay() + 7) % 7) + 21); return d; };
  return [an, an + 1].flatMap((a) => [
    { nom: "La Saint-Valentin", date: new Date(a, 1, 14) },
    { nom: "La rentrée scolaire", date: new Date(a, 8, 1) },
    { nom: "Le Black Friday", date: blackFriday(a) },
    { nom: "Noël", date: new Date(a, 11, 25) },
  ]).concat(FETES_VARIABLES.map((f) => ({ nom: f.nom, date: new Date(f.date) })));
}

async function fetes(): Promise<Constat | null> {
  for (const f of prochainesFetes()) {
    const jours = Math.ceil((f.date.getTime() - Date.now()) / JOUR);
    if (jours < 7 || jours > 14) continue;
    return {
      type: "fete", cle: `fete:${f.nom}:${f.date.toISOString().slice(0, 10)}`, priorite: 5,
      texte: `${f.nom} dans ${jours} jours. C'est le moment de préparer une offre et ton stock. On s'y met ?`,
      action: { prompt: `${f.nom} arrive dans ${jours} jours. Propose-moi une opération commerciale adaptée à ma boutique : produits à mettre en avant, offre, message et calendrier.` },
    };
  }
  return null;
}

// ─── Orchestration ───────────────────────────────────────────────────────────

const DETECTEURS: ((ctx: Ctx) => Promise<Constat | null>)[] = [
  ventes, stockBas, topFlop, fichesIncompletes, paiementsNonFinalises, commandesBloquees,
  clientsInactifs, avisNegatifs, messagesSansReponse, objectifs, abonnement, boutiqueBrouillon, rappels, fetes,
];

/** Reformule les constats dans le style du marchand ; garde le texte par défaut si l'IA échoue. */
async function formuler(constats: Constat[], tenantId: string, nomBoutique: string, langue: string): Promise<string[]> {
  const parDefaut = constats.map((c) => c.texte);
  try {
    await rafraichirStyle(tenantId);
    const style = await lireStyle(tenantId);
    const { text } = await completionAuto([
      {
        role: "system",
        content: `Tu es AXIA, l'associée du marchand de la boutique « ${nomBoutique} ». Tu prends la parole de toi-même dans une petite bulle. Reformule chaque constat en un message de 2 phrases maximum (220 caractères maximum), en ${langue === "en" ? "anglais" : "français"}, sans salutation. Garde exactement les chiffres et les noms ; n'ajoute aucune information. Si le constat se termine par une question, garde la question.
Réponds uniquement en JSON : {"messages": ["…", "…"]}, dans le même ordre.${style ? `\n\n${consigneStyle(style)}` : ""}`,
      },
      { role: "user", content: constats.map((c, i) => `${i + 1}. ${c.texte}`).join("\n") },
    ], 800, true);
    const messages = JSON.parse(text)?.messages;
    if (Array.isArray(messages) && messages.length === constats.length && messages.every((m) => typeof m === "string" && m.trim())) {
      return messages.map((m: string) => m.trim().slice(0, 300));
    }
  } catch (err: any) {
    console.warn("[axia-constats] formulation:", err?.message?.slice(0, 100));
  }
  return parDefaut;
}

export async function detecterConstats(tenantId: string, langue: string): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { nomBoutique: true, devise: true, statut: true, planExpiresAt: true },
  });
  if (!tenant) return;

  const debutJour = new Date(); debutJour.setHours(0, 0, 0, 0);
  const recents = await prisma.axiaProposition.findMany({
    where: { tenantId, type: { not: "confirmation" }, createdAt: { gte: il_y_a(30) } },
    select: { type: true, createdAt: true },
  });
  const restants = MAX_PAR_JOUR - recents.filter((r) => r.createdAt >= debutJour).length;
  if (restants <= 0) return;

  const devise = tenant.devise || "XAF";
  const ctx: Ctx = {
    tenantId, devise, statut: tenant.statut, planExpiresAt: tenant.planExpiresAt,
    fmt: (n) => `${Math.round(n).toLocaleString("fr-FR")} ${devise}`,
  };
  const resultats = await Promise.all(DETECTEURS.map((d) => d(ctx).catch((err) => {
    console.warn("[axia-constats]", d.name, err?.message?.slice(0, 100));
    return null;
  })));

  const candidats = resultats.filter((c): c is Constat => !!c);
  const dejaVus = await prisma.axiaProposition.findMany({ where: { tenantId, cle: { in: candidats.map((c) => c.cle) } }, select: { cle: true } });
  const cles = new Set(dejaVus.map((r) => r.cle));
  const nouveaux = candidats
    .filter((c) => !cles.has(c.cle))
    .filter((c) => !c.cooldownJours || !recents.some((r) => r.type === c.type && r.createdAt >= il_y_a(c.cooldownJours!)))
    .sort((a, b) => b.priorite - a.priorite)
    .slice(0, restants);
  if (!nouveaux.length) return;

  const messages = await formuler(nouveaux, tenantId, tenant.nomBoutique, langue);
  await prisma.axiaProposition.createMany({
    skipDuplicates: true,
    data: nouveaux.map((c, i) => ({ tenantId, type: c.type, cle: c.cle, message: messages[i], action: c.action ?? undefined })),
  });
}
