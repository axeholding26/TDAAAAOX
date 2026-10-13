// Assistant AXSO Sourcing — l'interface unique du module. SERVEUR uniquement.
//
// L'assistant ne calcule rien lui-même : chaque outil appelle un moteur de
// lib/sourcing (coût réel, prix, score, fournisseurs, commandes, stocks, bénéfice).
// Il ne modifie rien d'engageant non plus : publier, fixer un prix, changer de mode
// ou créer une commande fournisseur sont des PROPOSITIONS. Le marchand clique sur
// « Confirmer » et c'est la route existante qui s'exécute, avec ses contrôles.
// Seule écriture directe : ouvrir un dossier (fiche de travail, hors boutique).
import { prisma } from "@/lib/prisma";
import { prixClient } from "@/lib/pricing";
import type { AxiaTool, ToolExecutor } from "@/lib/axia/engine";
import { contexteCalcul, journaliser, type Acces } from "./acces";
import { commandesSourcing } from "./commandes";
import { connecteur, CONNECTEURS } from "./connecteurs";
import { normaliserDevise } from "./cout-rendu";
import { analyserProduit, genererKitTest, genererPublicites, budgetTest, AVERTISSEMENT_IA } from "./ia";
import { ETAPES_PRODUIT, MODES_APPRO, evaluerProduit, type ContexteCalcul, type Evaluation } from "./produit-source";
import { tableauDeBord } from "./profit";
import { alertesSourcing } from "./alertes";
import { previsionsStock } from "./stocks";
import { libelleEtape } from "./statuts";
import { rechercher } from "./fournisseurs/service";

/** Réponse riche affichée en carte plutôt qu'en texte. */
export interface CarteAssistant { titre: string; lignes: { libelle: string; valeur: string; fort?: boolean }[]; note?: string }
/** Action à confirmer par le marchand : l'appel est construit ici, jamais par le modèle. */
export interface Proposition { libelle: string; detail: string; appel: { url: string; method: "POST" | "PATCH"; body?: unknown } }

export interface SessionAssistant {
  acces: Acces;
  /** Droit sur le module « commandes » (suivi, alertes, bénéfice, commande fournisseur). */
  commandes: boolean;
  dossierId: string | null;
  cartes: CarteAssistant[];
  propositions: Proposition[];
}

const texte = { type: "string" } as const;
const nombre = { type: "number" } as const;
const outil = (name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []): AxiaTool =>
  ({ name, description, parameters: { type: "object", properties, required } });

export const OUTILS_ASSISTANT: AxiaTool[] = [
  outil("mes_produits", "Liste les dossiers produits du marchand (nom, étape, coût réel, prix, bénéfice, score)."),
  outil("ouvrir_produit", "Ouvre un dossier produit et donne son calcul complet : coût réel ligne par ligne, prix conseillé, bénéfice, score.", { produitSourceId: texte }, ["produitSourceId"]),
  outil("enregistrer_produit", "Ouvre un nouveau dossier à partir de ce que le marchand a donné (nom et prix d'achat obligatoires). N'utilise QUE des informations fournies par le marchand : ne devine ni prix ni poids. Un lien est gardé comme référence, rien n'y est lu.",
    { nom: texte, prixFournisseur: nombre, devise: { ...texte, description: "Devise du prix d'achat (USD, CNY, XAF…). Demande-la si elle n'est pas dite." }, poidsKg: nombre, url: texte, fournisseurNom: texte, description: texte }, ["nom", "prixFournisseur", "devise"]),
  outil("simuler_prix", "Calcule ce que le marchand gagne par commande s'il vend à un prix donné. Ne modifie rien.", { produitSourceId: texte, prixVente: nombre }, ["produitSourceId", "prixVente"]),
  outil("analyser_produit", "Analyse IA du produit : faut-il le tester, pour quel client, quels risques. Hypothèses, pas des données de marché.", { produitSourceId: texte }, ["produitSourceId"]),
  outil("preparer_page_produit", "Rédige la page de vente du produit (titre, description, avantages, questions fréquentes, offre). Elle sera utilisée à la publication.", { produitSourceId: texte }, ["produitSourceId"]),
  outil("preparer_publicites", "Rédige des publicités prêtes à poster (accroche, texte Facebook et TikTok, audience) et calcule le budget de test.", { produitSourceId: texte }, ["produitSourceId"]),
  outil("comparer_fournisseurs", "Compare les fournisseurs enregistrés par le marchand pour un produit : coût réel rendu, score, risque, recommandation.", { recherche: { ...texte, description: "Nom du produit recherché" }, quantite: nombre }),
  outil("suivi_commandes", "Commandes à faire livrer par un fournisseur : étape et prochaine action."),
  outil("alertes", "Alertes en cours : ruptures de stock à venir, marge faible, fournisseur lent, produit à développer."),
  outil("bilan", "Chiffre d'affaires, bénéfice net estimé, marge, taux de livraison et de refus sur 7, 30 ou 90 jours.", { jours: nombre }),
  outil("proposer_action", "Prépare une action à faire confirmer par le marchand. Ne l'exécute pas.", {
    action: { ...texte, enum: ["publier", "fixer_prix", "changer_mode", "changer_etape", "commander_fournisseur"] },
    produitSourceId: texte, prixVente: nombre,
    mode: { ...texte, enum: MODES_APPRO.map((m) => m.cle) },
    etape: { ...texte, enum: ETAPES_PRODUIT.map((e) => e.cle) },
    commandeId: { ...texte, description: "Pour commander_fournisseur : identifiant de la commande client." },
  }, ["action"]),
];

export function promptAssistant(ctx: ContexteCalcul, tauxCommission: number, nomBoutique: string): string {
  const aConnecter = CONNECTEURS.filter((c) => c.statut === "a_connecter").map((c) => c.nom).join(", ");
  return `Tu es l'assistant AXSO Sourcing de la boutique « ${nomBoutique} » (pays ${ctx.pays}, devise ${ctx.devise}). Tu aides un commerçant, souvent débutant, à faire du dropshipping et de l'import : trouver un produit, calculer ce qu'il gagne vraiment, choisir un fournisseur, publier, faire livrer, suivre son bénéfice.

RÈGLES ABSOLUES
- Tu n'inventes RIEN : ni produit, ni prix, ni fournisseur, ni certification, ni avis, ni chiffre de marché. Tu n'as accès à aucun catalogue externe : ${aConnecter} ne sont pas encore connectés. Si le marchand demande de « trouver un produit », dis-le simplement et demande-lui le nom et le prix d'achat du produit qu'il a repéré.
- Tous les chiffres viennent des outils. N'en calcule aucun toi-même. Ce qui est une estimation, dis que c'est une estimation.
- Tu ne fais aucune action engageante : pour publier, fixer un prix, changer de mode ou commander au fournisseur, appelle proposer_action puis dis au marchand de cliquer sur « Confirmer ». Ne dis jamais que c'est fait.
- Commission Axso : ${Math.round(tauxCommission * 100)} % ajoutés au prix quand le client paie en ligne ; le marchand touche son prix en entier. Aucune commission sur un produit payé à la livraison.

STYLE
- Français simple, phrases courtes, tutoiement. Aucun jargon sans l'expliquer en trois mots.
- Texte brut uniquement : pas de markdown, pas d'astérisques, pas de titres.
- Le bouton « Confirmer » s'affiche juste sous ta réponse.
- Les détails chiffrés s'affichent déjà en carte à côté de ta réponse : ne les recopie pas, donne la conclusion et la prochaine étape.
- Termine par UNE seule prochaine action concrète.`;
}

const fmt = (n: number | null | undefined, devise: string) => (n == null || !Number.isFinite(n) ? "—" : `${Math.round(n).toLocaleString("fr-FR")} ${devise}`);
const pct = (n: number | null | undefined) => (n == null ? "—" : `${Math.round(n * 100)} %`);

/** Carte « coût réel et bénéfice » d'un produit. */
function carteCalcul(nom: string, ev: Evaluation, prixEnLigne: number | null): CarteAssistant {
  const d = ev.cout.devise;
  return {
    titre: nom,
    lignes: [
      ...ev.cout.lignes.filter((l) => l.montant > 0).map((l) => ({ libelle: l.libelle, valeur: fmt(l.montant, d) })),
      { libelle: "Coût réel par commande", valeur: fmt(ev.cout.coutTotal, d), fort: true },
      { libelle: "Prix de vente", valeur: fmt(ev.cout.prixVente, d) },
      ...(prixEnLigne ? [{ libelle: "Payé par le client en ligne", valeur: fmt(prixEnLigne, d) }] : []),
      { libelle: "Bénéfice par commande livrée", valeur: `${fmt(ev.cout.margeNette, d)} (${pct(ev.cout.tauxMargeNette)})`, fort: true },
      { libelle: "Score", valeur: `${ev.score.total}/100 — ${ev.score.verdict}` },
    ],
    note: "Droits, refus et retours sont des estimations tant que tu ne les as pas réglés.",
  };
}

export function executeurAssistant(s: SessionAssistant, tauxCommission: number): ToolExecutor {
  const { tenantId } = s.acces;
  let contexte: Promise<ContexteCalcul> | null = null;
  const ctx = () => (contexte ??= contexteCalcul(tenantId));
  const ok = (resultat: string) => ({ succes: true, resultat });
  const refus = (resultat: string) => ({ succes: false, resultat });
  const SANS_DROIT = "Ce compte n'a pas accès aux commandes de la boutique : demande au propriétaire.";

  const charger = async (id: unknown) => {
    const source = typeof id === "string" ? await prisma.produitSource.findFirst({ where: { id, tenantId } }) : null;
    if (source) s.dossierId = source.id;
    return source;
  };
  const typeProduit = (mode: string) => MODES_APPRO.find((m) => m.cle === mode)?.typeProduit ?? "dropshipping";
  /** Prix payé en ligne par le client, ou null si ce produit se paie à la livraison (aucune commission). */
  const enLigne = (prix: number | null, mode: string) => {
    if (!prix) return null;
    const p = prixClient(prix, tauxCommission, typeProduit(mode));
    return p === prix ? null : p;
  };

  return async (nom, args) => {
    switch (nom) {
      case "mes_produits": {
        const [sources, c] = await Promise.all([prisma.produitSource.findMany({ where: { tenantId }, orderBy: { updatedAt: "desc" }, take: 15 }), ctx()]);
        if (!sources.length) return ok("Aucun dossier produit pour l'instant. Demande au marchand le nom et le prix d'achat du produit qu'il a repéré.");
        return ok(sources.map((p) => {
          const ev = evaluerProduit(p, c);
          return `• ${p.nom} [id ${p.id}] — étape ${p.etape}${p.produitId ? ", en boutique" : ", pas encore publié"} — coût réel ${fmt(ev.cout.coutTotal, c.devise)}, prix ${fmt(ev.cout.prixVente, c.devise)}, bénéfice ${fmt(ev.cout.margeNette, c.devise)}, score ${ev.score.total}/100`;
        }).join("\n"));
      }

      case "ouvrir_produit":
      case "simuler_prix": {
        const source = await charger(args.produitSourceId);
        if (!source) return refus("Dossier introuvable. Appelle mes_produits pour retrouver son identifiant.");
        const prixTeste = nom === "simuler_prix" ? Number(args.prixVente) : null;
        if (prixTeste !== null && !(prixTeste > 0)) return refus("Prix de vente invalide.");
        const c = await ctx();
        const ev = evaluerProduit(prixTeste ? { ...source, tarification: { ...(source.tarification as object | null), prixVente: prixTeste } } : source, c);
        s.cartes.push(carteCalcul(prixTeste ? `${source.nom} — vendu ${fmt(prixTeste, c.devise)}` : source.nom, ev, enLigne(ev.cout.prixVente, source.modeAppro)));
        return ok([
          `${source.nom} — coût réel ${fmt(ev.cout.coutTotal, c.devise)} par commande, prix ${prixTeste ? "testé" : "retenu"} ${fmt(ev.cout.prixVente, c.devise)}, bénéfice ${fmt(ev.cout.margeNette, c.devise)} (${pct(ev.cout.tauxMargeNette)}).`,
          `Prix conseillé : ${fmt(ev.conseil.prix, c.devise)}. ${ev.conseil.explication.join(" ")}`,
          `Score ${ev.score.total}/100 : ${ev.score.verdict} (calculé sur ${pct(ev.score.confiance)} des critères).`,
          `Étape ${source.etape}, ${source.produitId ? "déjà en boutique" : "pas encore publié"}, mode ${source.modeAppro}.`,
          ev.cout.margeNette !== null && ev.cout.margeNette <= 0 ? "À ce prix, chaque vente PERD de l'argent." : "",
          prixTeste ? "Simulation seulement : rien n'est enregistré." : "",
        ].filter(Boolean).join("\n"));
      }

      case "enregistrer_produit": {
        const devise = normaliserDevise(args.devise);
        if (!devise) return refus(`Devise inconnue : « ${args.devise} ». Demande au marchand dans quelle devise est le prix d'achat.`);
        const url = typeof args.url === "string" && /^https?:\/\//.test(args.url) ? args.url : undefined;
        try {
          const fiche = await connecteur("manuel").importer({
            url, donnees: { nom: args.nom, prixFournisseur: Number(args.prixFournisseur), deviseFournisseur: devise, ...(args.poidsKg > 0 && { poidsKg: Number(args.poidsKg) }), ...(args.fournisseurNom && { fournisseurNom: String(args.fournisseurNom) }), ...(args.description && { description: String(args.description) }) },
          });
          const source = await prisma.produitSource.create({ data: { ...fiche, tenantId, connecteur: "manuel" } });
          await journaliser(s.acces, "produit_importe", `ProduitSource:${source.id}`, { connecteur: "manuel", nom: source.nom, origine: "assistant" });
          s.dossierId = source.id;
          const c = await ctx();
          const ev = evaluerProduit(source, c);
          s.cartes.push(carteCalcul(source.nom, ev, enLigne(ev.cout.prixVente, source.modeAppro)));
          return ok(`Dossier ouvert [id ${source.id}] pour ${source.nom}. Coût réel ${fmt(ev.cout.coutTotal, c.devise)}, prix conseillé ${fmt(ev.conseil.prix, c.devise)}, bénéfice ${fmt(ev.cout.margeNette, c.devise)}, score ${ev.score.total}/100.${url ? " Le lien est gardé comme référence : rien n'y a été lu." : ""}${args.poidsKg > 0 ? "" : " Poids non renseigné : le transport n'est pas compté, demande-le."}`);
        } catch (e) {
          return refus(`Dossier non créé : ${(e as Error).message?.slice(0, 160)}`);
        }
      }

      case "analyser_produit": {
        const source = await charger(args.produitSourceId);
        if (!source) return refus("Dossier introuvable.");
        const c = await ctx();
        const a = await analyserProduit(source, evaluerProduit(source, c), c);
        await prisma.produitSource.update({ where: { id: source.id }, data: { analyseIA: { ...a, date: new Date().toISOString() } } });
        s.cartes.push({ titre: `Analyse — ${source.nom}`, lignes: [
          { libelle: "Avis", valeur: { tester: "À tester", tester_avec_prudence: "À tester avec prudence", eviter: "À éviter" }[a.verdict] ?? a.verdict, fort: true },
          { libelle: "Client visé", valeur: a.profilClient },
          { libelle: "Risques", valeur: a.risques.slice(0, 3).join(" · ") || "—" },
        ], note: AVERTISSEMENT_IA });
        return ok(`Verdict : ${a.verdict}. ${a.resume}\nLancement : ${a.strategieLancement.slice(0, 3).join(" ; ")}\n(${AVERTISSEMENT_IA})`);
      }

      case "preparer_page_produit":
      case "preparer_publicites": {
        const source = await charger(args.produitSourceId);
        if (!source) return refus("Dossier introuvable.");
        const c = await ctx();
        const ev = evaluerProduit(source, c);
        const date = new Date().toISOString();
        if (nom === "preparer_page_produit") {
          const kit = await genererKitTest(source, ev, c);
          await prisma.produitSource.update({ where: { id: source.id }, data: { kitTest: { ...kit, date } } });
          s.cartes.push({ titre: "Page de vente prête", lignes: [{ libelle: "Titre", valeur: kit.titre, fort: true }, { libelle: "Offre", valeur: kit.offrePromotionnelle }, ...kit.avantages.slice(0, 3).map((a, i) => ({ libelle: `Avantage ${i + 1}`, valeur: a }))], note: "Texte rédigé par IA : relisez-le. Il sera repris à la publication." });
          return ok(`Page de vente rédigée et enregistrée pour ${source.nom} : titre « ${kit.titre} », ${kit.avantages.length} avantages, ${kit.faq.length} questions fréquentes. Elle sera utilisée quand le produit sera publié.`);
        }
        const pubs = await genererPublicites(source, ev, c);
        await prisma.produitSource.update({ where: { id: source.id }, data: { publicites: { variantes: pubs, date } as object } });
        const budget = budgetTest(ev);
        s.cartes.push(...pubs.slice(0, 3).map((p) => ({ titre: `Publicité — ${p.angle}`, lignes: [{ libelle: "Accroche", valeur: p.hook, fort: true }, { libelle: "Texte Facebook", valeur: p.texteFacebook }, { libelle: "Audience", valeur: p.audience }], note: "Rédigé par IA : aucune promesse chiffrée n'est vérifiée." })));
        return ok(`${pubs.length} publicités rédigées pour ${source.nom}.${budget ? ` Budget de test conseillé : ${fmt(budget.total, c.devise)} (${budget.explication})` : ""}`);
      }

      case "comparer_fournisseurs": {
        const quantite = Number(args.quantite) > 0 ? Math.floor(Number(args.quantite)) : undefined;
        const r = await rechercher(tenantId, { q: typeof args.recherche === "string" ? args.recherche.slice(0, 200) : undefined, quantite });
        if (!r.totalFournisseurs) return ok("Le marchand n'a enregistré aucun fournisseur. Il peut en ajouter depuis « Mes fournisseurs » sur cette page. Aucun annuaire externe n'est connecté.");
        if (!r.candidats.length) return ok(`Aucun des ${r.totalFournisseurs} fournisseurs enregistrés ne propose ce produit.`);
        const top = r.candidats.slice(0, 5);
        s.cartes.push({
          titre: "Fournisseurs comparés",
          lignes: top.map((c) => ({ libelle: c.fournisseur.nom, valeur: `${c.cout ? fmt(c.cout.total, c.cout.devise) : "prix inconnu"} · score ${c.analyse.score}/100 · risque ${c.analyse.risque.niveau}`, fort: c.ref === r.recommandation?.ref })),
          note: "Coût réel rendu par unité. Un score sur des informations seulement déclarées n'est pas une garantie.",
        });
        return ok(r.recommandation
          ? `${r.recommandation.explication}\nPoints forts : ${r.recommandation.raisons.join(", ") || "aucun établi"}.\nRéserves : ${r.recommandation.reserves.slice(0, 4).join(", ") || "aucune"}.${r.recommandation.ferme ? "" : "\nRecommandation NON ferme : données insuffisantes."}`
          : `${top.length} fournisseur(s) trouvé(s), sans offre comparable : précise le produit recherché.`);
      }

      case "suivi_commandes": {
        if (!s.commandes) return refus(SANS_DROIT);
        const enCours = (await commandesSourcing(tenantId)).filter((c) => !["livree", "annulee"].includes(c.statut)).slice(0, 8);
        if (!enCours.length) return ok("Aucune commande fournisseur en cours.");
        s.cartes.push({ titre: "Commandes en cours", lignes: enCours.map((c) => ({ libelle: `#${c.numero} · ${c.clientNom}`, valeur: libelleEtape(c.etape) })) });
        return ok(enCours.map((c) => `• #${c.numero} [commandeId ${c.id}] ${c.articles} — ${libelleEtape(c.etape)}${c.sansFournisseur ? " — aucune commande fournisseur n'existe encore : vérifie qu'un fournisseur est rattaché au produit, puis propose commander_fournisseur" : c.commandesFournisseur.some((cf) => cf.statut === "en_attente") ? " — à commander chez le fournisseur" : ""}`).join("\n"));
      }

      case "alertes":
      case "bilan": {
        if (!s.commandes) return refus(SANS_DROIT);
        const jours = [7, 30, 90].includes(Number(args.jours)) ? Number(args.jours) : 30;
        const tdb = await tableauDeBord(tenantId, jours);
        if (nom === "bilan") {
          const k = tdb.kpi;
          s.cartes.push({ titre: `Bilan ${jours} jours`, lignes: [
            { libelle: "Chiffre d'affaires", valeur: fmt(k.ca, tdb.devise) },
            { libelle: "Bénéfice net estimé", valeur: fmt(k.benefice, tdb.devise), fort: true },
            { libelle: "Commandes", valeur: String(k.commandes) },
            { libelle: "Marge nette", valeur: pct(k.margeNette) },
            { libelle: "Livrées / refusées", valeur: `${pct(k.tauxLivraison)} / ${pct(k.tauxRefus)}` },
          ], note: "Le bénéfice est une estimation : il dépend des coûts que tu as renseignés." });
          return ok(`Sur ${jours} jours : chiffre d'affaires ${fmt(k.ca, tdb.devise)}, bénéfice net estimé ${fmt(k.benefice, tdb.devise)}, ${k.commandes} commande(s), marge nette ${pct(k.margeNette)}, taux de refus ${pct(k.tauxRefus)}.`);
        }
        const alertes = await alertesSourcing(tenantId, tdb, await previsionsStock(tenantId));
        if (!alertes.length) return ok("Aucune alerte en cours.");
        s.cartes.push({ titre: "Alertes", lignes: alertes.slice(0, 6).map((a) => ({ libelle: a.titre, valeur: a.message, fort: a.ton === "attention" })) });
        return ok(alertes.map((a) => `• ${a.titre} : ${a.message}`).join("\n"));
      }

      case "proposer_action": {
        if (args.action === "commander_fournisseur") {
          if (!s.commandes) return refus(SANS_DROIT);
          const commande = typeof args.commandeId === "string" ? await prisma.commande.findFirst({ where: { id: args.commandeId, tenantId }, select: { id: true, numero: true } }) : null;
          if (!commande) return refus("Commande introuvable. Appelle suivi_commandes pour retrouver son identifiant.");
          s.propositions.push({ libelle: `Créer la commande fournisseur de #${commande.numero}`, detail: "Elle apparaît dans « À faire » avec le message à envoyer au fournisseur. Rien ne lui est transmis automatiquement.", appel: { url: "/api/dropshipping/commandes-fournisseur", method: "POST", body: { commandeId: commande.id } } });
          return ok(`EN ATTENTE DE CONFIRMATION : créer la commande fournisseur de #${commande.numero}.`);
        }
        const source = await charger(args.produitSourceId);
        if (!source) return refus("Dossier introuvable.");
        const url = `/api/sourcing/produits/${source.id}`;
        const c = await ctx();
        if (args.action === "publier") {
          const ev = evaluerProduit(source, c);
          const enLigneP = enLigne(ev.cout.prixVente, source.modeAppro);
          s.propositions.push({ libelle: source.produitId ? `Mettre à jour le prix de ${source.nom} en boutique` : `Publier ${source.nom} dans ma boutique`, detail: `Prix de vente ${fmt(ev.cout.prixVente, c.devise)}${enLigneP ? ` (le client paie ${fmt(enLigneP, c.devise)} en ligne, commission incluse)` : ""}. Bénéfice estimé ${fmt(ev.cout.margeNette, c.devise)} par commande.`, appel: { url: `${url}/publier`, method: "POST" } });
        } else if (args.action === "fixer_prix") {
          const prix = Number(args.prixVente);
          if (!(prix > 0)) return refus("Prix de vente invalide.");
          const ev = evaluerProduit({ ...source, tarification: { ...(source.tarification as object | null), prixVente: prix } }, c);
          s.propositions.push({ libelle: `Fixer le prix de ${source.nom} à ${fmt(prix, c.devise)}`, detail: `Bénéfice estimé ${fmt(ev.cout.margeNette, c.devise)} par commande.${source.produitId ? " Le produit en boutique garde son ancien prix tant que tu ne le republies pas." : ""}`, appel: { url, method: "PATCH", body: { tarification: { ...(source.tarification as object | null), prixVente: prix } } } });
        } else if (args.action === "changer_mode") {
          const mode = MODES_APPRO.find((m) => m.cle === args.mode);
          if (!mode) return refus("Mode inconnu.");
          s.propositions.push({ libelle: `Passer ${source.nom} en « ${mode.libelle} »`, detail: `${mode.resume}${source.produitId && mode.cle !== "dropshipping" && source.modeAppro === "dropshipping" ? " Attention : le stock du produit en boutique repart de 0 jusqu'à la réception de la marchandise." : ""}`, appel: { url, method: "PATCH", body: { modeAppro: mode.cle } } });
        } else if (args.action === "changer_etape") {
          const etape = ETAPES_PRODUIT.find((e) => e.cle === args.etape);
          if (!etape) return refus("Étape inconnue.");
          s.propositions.push({ libelle: `Passer ${source.nom} à l'étape « ${etape.libelle} »`, detail: etape.objectif, appel: { url, method: "PATCH", body: { etape: etape.cle } } });
        } else return refus("Action inconnue.");
        return ok(`EN ATTENTE DE CONFIRMATION : ${s.propositions[s.propositions.length - 1].libelle}. Dis au marchand de cliquer sur « Confirmer ».`);
      }
    }
    return refus(`Outil inconnu : ${nom}`);
  };
}
