// Données de DÉMONSTRATION — fictives mais cohérentes (graine fixe : mêmes chiffres
// pour tout le monde le même jour). Jamais mélangées aux données réelles : la
// source est choisie explicitement (paramètre ?source=demo) et un bandeau le signale.
import type { Dataset, Marchand, Commande, PaiementAbonnement, EvtIA, EvtFonction, PlanId, Fonction, TypeIA, Visites, DepenseMarketing, Experience, Incident, Ticket, StatutCommande } from "./types";
import { PRIX_PLAN } from "./types";

const JOUR = 86_400_000;

function prng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PAYS_POIDS: [string, number][] = [["CM", 34], ["CI", 22], ["SN", 13], ["CD", 8], ["GA", 6], ["TG", 5], ["BJ", 5], ["BF", 3], ["ML", 2], ["CG", 2]];
const INDUSTRIES: [string, number][] = [["Mode", 26], ["Beauté", 18], ["Alimentation", 14], ["Électronique", 11], ["Maison", 9], ["Santé", 6], ["Produits digitaux", 8], ["Services", 8]];
const SOURCES: [string, number][] = [["organique", 34], ["ads_meta", 22], ["parrainage", 15], ["tiktok", 12], ["ads_google", 9], ["partenaire", 8]];
const PREFIXES = ["Maison", "Boutique", "Chez", "Atelier", "Comptoir", "Galerie", "Espace", "Marché", "Univers", "Studio"];
const NOMS = ["Aminata", "Kofi", "Grâce", "Ndeye", "Moussa", "Awa", "Yao", "Fatou", "Ibrahim", "Esther", "Koffi", "Mariam", "Serge", "Aïcha", "Didier", "Binta", "Junior", "Rokia", "Paul", "Nafi", "Eric", "Salif", "Linda", "Omar", "Prisca", "Cheikh", "Sandrine", "Malick", "Adjoa", "Hervé"];
const SUFFIXES = ["Style", "Beauty", "Market", "Shop", "Store", "Collection", "Bio", "Tech", "Home", "Créations", "Wax", "Délices", "Cosmetics", "Fashion", "Digital"];

function pick<T>(r: () => number, poids: [T, number][]): T {
  const total = poids.reduce((s, [, p]) => s + p, 0);
  let x = r() * total;
  for (const [v, p] of poids) { x -= p; if (x <= 0) return v; }
  return poids[poids.length - 1][0];
}
function poisson(r: () => number, lambda: number) {
  if (lambda <= 0) return 0;
  const L = Math.exp(-Math.min(lambda, 30));
  let k = 0, p = 1;
  do { k++; p *= r(); } while (p > L);
  return k - 1;
}
const lognormal = (r: () => number, mu: number, sigma: number) => Math.exp(mu + sigma * Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r()));

let memo: { jour: number; ds: Dataset } | null = null;

export function genererDemo(maintenant = Date.now()): Dataset {
  const jourAncre = Math.floor(maintenant / JOUR) * JOUR;
  if (memo?.jour === jourAncre) return { ...memo.ds, genereA: maintenant, commandes: memo.ds.commandes.filter((c) => c.date <= maintenant) };
  const r = prng(20261017);
  const fin = jourAncre + JOUR;
  const debut = jourAncre - 450 * JOUR;
  const nbJours = 451;

  const marchands: Marchand[] = [];
  const commandes: Commande[] = [];
  const abonnements: PaiementAbonnement[] = [];
  const ia: EvtIA[] = [];
  const fonctions: EvtFonction[] = [];
  const tickets: Ticket[] = [];

  let id = 0;
  for (let d = 0; d < nbJours; d++) {
    // Inscriptions en croissance (~0,6/jour il y a 15 mois → ~3,5/jour aujourd'hui), creux le dimanche.
    const jour = debut + d * JOUR;
    const dimanche = new Date(jour).getUTCDay() === 0;
    const nbInscrits = poisson(r, (0.6 + 2.9 * (d / nbJours) ** 1.4) * (dimanche ? 0.5 : 1));
    for (let i = 0; i < nbInscrits; i++) {
      const mId = `demo_${++id}`;
      const creeLe = jour + Math.floor(r() * JOUR);
      const pays = pick(r, PAYS_POIDS);
      const source = pick(r, SOURCES);
      // Vitalité : intensité commerciale du marchand (parrainage et partenaires = marchands plus solides).
      const vitalite = lognormal(r, source === "parrainage" || source === "partenaire" ? 0.15 : -0.1, 0.8);
      const aBoutique = r() < 0.93;
      const aProduit = aBoutique && r() < 0.78;
      const aCommande = aProduit && r() < 0.62 + Math.min(0.2, vitalite * 0.05);
      const etapes = {
        boutique: aBoutique ? creeLe + r() * 2 * JOUR : null,
        produit: aProduit ? creeLe + (1 + r() * 4) * JOUR : null,
        commande: aCommande ? creeLe + (3 + r() * 18) * JOUR : null,
        paiement: null as number | null,
      };
      // Durée de vie : une part des marchands devient dormante.
      const dormantLe = r() < 0.38 ? creeLe + (10 + lognormal(r, 4, 0.9)) * JOUR : Infinity;
      // Une partie des dormants revient après 1 à 3 mois (réactivation).
      const repriseLe = dormantLe < Infinity && r() < 0.18 ? dormantLe + (30 + r() * 60) * JOUR : Infinity;
      const vivant = (t: number) => t < dormantLe || t >= repriseLe;
      const adopteIA = r() < 0.3 + Math.min(0.35, vitalite * 0.15);
      const adopte: Fonction[] = ["commandes"];
      if (aProduit) adopte.push("stock");
      if (aBoutique) adopte.push("constructeur");
      if (adopteIA) adopte.push("axia");
      if (r() < 0.22 + vitalite * 0.08) adopte.push("pos");
      if (r() < 0.4) adopte.push("livraison");
      if (r() < 0.35 + (adopteIA ? 0.15 : 0)) adopte.push("marketing");
      if (r() < 0.55) adopte.push("paiements");
      // Les utilisateurs POS + IA vendent davantage (corrélation présente dans les données, détectée par le moteur, pas affirmée en dur).
      const intensite = vitalite * (adopteIA ? 1.5 : 1) * (adopte.includes("pos") ? 1.3 : 1);

      // Plan : passage Pro / Illimité selon l'intensité.
      let plan: PlanId = "palier0";
      let upgradeLe = Infinity, upgrade2Le = Infinity;
      if (aCommande && r() < Math.min(0.55, 0.12 + intensite * 0.12)) { upgradeLe = etapes.commande! + (5 + r() * 40) * JOUR; plan = "palier1"; }
      if (plan === "palier1" && r() < Math.min(0.35, intensite * 0.08)) { upgrade2Le = upgradeLe + (20 + r() * 90) * JOUR; }
      const paiementEnLigne = adopte.includes("paiements");
      let premierPaiement: number | null = null;
      let derniere = creeLe;
      const panier = lognormal(r, Math.log(14000), 0.7);
      const nom = `${r() < 0.5 ? PREFIXES[Math.floor(r() * PREFIXES.length)] + " " : ""}${NOMS[Math.floor(r() * NOMS.length)]} ${SUFFIXES[Math.floor(r() * SUFFIXES.length)]}`;

      if (etapes.commande) {
        for (let t = etapes.commande; t < fin; t += JOUR) {
          if (!vivant(t)) continue;
          const anciennete = (t - creeLe) / JOUR;
          const lambda = 0.12 * intensite * Math.min(1, 0.3 + anciennete / 60) * (1 + 0.6 * ((t - debut) / (fin - debut)));
          const n = poisson(r, lambda);
          for (let k = 0; k < n; k++) {
            const date = t + Math.floor(r() * JOUR);
            const x = r();
            const statut: StatutCommande = x < 0.86 ? "payee" : x < 0.9 ? "annulee" : x < 0.92 ? "remboursee" : x < 0.97 ? "echouee" : "en_attente";
            const pos = adopte.includes("pos") && r() < 0.3;
            const y = r();
            const methode = pos ? (y < 0.6 ? "especes" : "mobile_money") : paiementEnLigne ? (y < 0.55 ? "mobile_money" : y < 0.68 ? "wave" : y < 0.78 ? "carte" : "cod") : "cod";
            const montant = Math.round(panier * lognormal(r, 0, 0.45) / 50) * 50;
            const livre = pos ? "sans_objet" : statut !== "payee" ? "non_expediee" : date > maintenant - 2 * JOUR ? "expediee" : r() < 0.93 ? "livree" : "echec";
            commandes.push({
              id: `${mId}_c${commandes.length}`, marchandId: mId, clientId: `${mId}_cl${Math.floor(r() * 40)}`, date, montant, statut, methode,
              canal: pos ? "pos" : "en_ligne", livraison: livre, delaiLivraisonH: livre === "livree" ? Math.round(lognormal(r, Math.log(30), 0.5)) : null,
              commission: statut === "payee" && !pos && methode !== "cod" ? Math.round(montant * 0.1) : 0,
            });
            if (statut === "payee" && methode !== "cod" && methode !== "especes" && !premierPaiement) premierPaiement = date;
            derniere = Math.max(derniere, date);
          }
        }
      }
      etapes.paiement = premierPaiement;

      // Paiements d'abonnement mensuels tant que le marchand n'est pas dormant (+ 1 mois de grâce).
      const finAbo = dormantLe === Infinity ? fin : dormantLe + 30 * JOUR;
      for (let t = upgradeLe; t < Math.min(fin, finAbo); t += 30 * JOUR) {
        const p: PlanId = t >= upgrade2Le ? "palier2" : "palier1";
        abonnements.push({ marchandId: mId, date: t, plan: p, montant: PRIX_PLAN[p] });
        plan = p;
      }
      if (finAbo < fin && upgradeLe < fin) plan = "palier0";
      if (upgradeLe >= fin) plan = "palier0";

      // Usage produit & IA, semaine par semaine pendant la vie active.
      // Semaines sans activité même chez les marchands vivants (rétention hebdomadaire réaliste).
      const assiduite = Math.min(0.9, 0.35 + 0.25 * intensite);
      for (let t = creeLe; t < fin; t += 7 * JOUR) {
        if (!vivant(t) || r() > assiduite) continue;
        for (const f of adopte) if (r() < 0.55 + Math.min(0.3, intensite * 0.1)) fonctions.push({ marchandId: mId, date: t + r() * 7 * JOUR, fonction: f });
        if (adopteIA) {
          const n = poisson(r, 2.2 * Math.min(3, intensite));
          for (let k = 0; k < n; k++) {
            const type = pick<TypeIA>(r, [["description", 34], ["conversation", 26], ["image", 16], ["pub", 10], ["agent", 9], ["boutique", 5]]);
            const tokens = Math.round(lognormal(r, Math.log(type === "boutique" ? 12000 : 1800), 0.5));
            ia.push({ marchandId: mId, date: t + r() * 7 * JOUR, type, nombre: 1, tokens, cout: Math.round(tokens * 0.0012 + (type === "image" ? 24 : type === "pub" ? 30 : 0)) });
          }
        }
        derniere = Math.max(derniere, Math.min(t + r() * 7 * JOUR, maintenant));
        const dt = t + r() * 7 * JOUR;
        if (r() < 0.03) tickets.push({ id: `${mId}_t${tickets.length}`, marchandId: mId, date: dt, resoluLe: r() < 0.9 ? dt + (0.2 + r() * 3) * JOUR : null, sujet: pick(r, [["Paiement non reçu", 3], ["Livraison", 2], ["Configuration boutique", 3], ["Axia IA", 1], ["Abonnement", 1]]) });
      }

      marchands.push({
        id: mId, nom, pays, plan, industrie: pick(r, INDUSTRIES), source, creeLe,
        derniereActivite: Math.min(derniere, maintenant), actif: r() > 0.02, etapes,
        nbProduits: aProduit ? Math.round(lognormal(r, Math.log(18), 0.9)) : 0,
        produitsStockFaible: aProduit ? poisson(r, 1.4) : 0,
      });
    }
  }

  // Les dates des boucles hebdomadaires peuvent dépasser « maintenant » : on tronque.
  const ok = <T extends { date: number }>(a: T[]) => a.filter((e) => e.date <= fin).sort((x, y) => x.date - y.date);

  const visites: Visites[] = [];
  const depenses: DepenseMarketing[] = [];
  for (let d = 0; d < nbJours; d++) {
    const jour = debut + d * JOUR;
    const croissance = 1 + 1.8 * (d / nbJours);
    for (const [src, base] of [["organique", 160], ["ads_meta", 120], ["tiktok", 80], ["ads_google", 50], ["parrainage", 30], ["partenaire", 20]] as [string, number][]) {
      visites.push({ date: jour, source: src, visiteurs: Math.round(base * croissance * (0.75 + r() * 0.5)) });
    }
    for (const [canal, base, camp] of [["ads_meta", 9000, "Meta — Lancez votre boutique"], ["ads_google", 6000, "Google — Boutique en ligne Afrique"], ["tiktok", 5000, "TikTok — Vendez en ligne"], ["partenaire", 2500, "Programme partenaires"], ["parrainage", 1500, "Parrainage 1 mois offert"]] as [string, number, string][]) {
      depenses.push({ canal, campagne: camp, date: jour, montant: Math.round(base * croissance * (0.8 + r() * 0.4)) });
    }
  }

  const experiences: Experience[] = [
    { id: "exp1", nom: "Onboarding en 3 étapes", type: "Onboarding", hypothese: "Réduire l'onboarding de 6 à 3 étapes augmente la création de boutique.", statut: "en_cours", debut: fin - 21 * JOUR, fin: null, variantes: [{ nom: "Contrôle", population: 412, conversions: 289 }, { nom: "3 étapes", population: 405, conversions: 318 }] },
    { id: "exp2", nom: "Prix Pro 5 000 vs 6 000 FCFA", type: "Pricing", hypothese: "Un Pro à 5 000 FCFA augmente la conversion payante sans baisser le MRR.", statut: "en_cours", debut: fin - 30 * JOUR, fin: null, variantes: [{ nom: "6 000 FCFA", population: 820, conversions: 61 }, { nom: "5 000 FCFA", population: 806, conversions: 74 }] },
    { id: "exp3", nom: "Landing « Vendez sur WhatsApp »", type: "Landing page", hypothese: "Mettre WhatsApp en avant augmente les inscriptions.", statut: "terminee", debut: fin - 75 * JOUR, fin: fin - 45 * JOUR, variantes: [{ nom: "Actuelle", population: 5400, conversions: 210 }, { nom: "WhatsApp", population: 5350, conversions: 268 }] },
    { id: "exp4", nom: "Axia proposé dès la 1re fiche produit", type: "Fonctionnalité", hypothese: "Suggérer Axia à la création de fiche augmente l'adoption IA.", statut: "terminee", debut: fin - 60 * JOUR, fin: fin - 30 * JOUR, variantes: [{ nom: "Sans suggestion", population: 640, conversions: 141 }, { nom: "Avec suggestion", population: 655, conversions: 149 }] },
    { id: "exp5", nom: "Relance SMS J+3 sans commande", type: "Campagne", hypothese: "Une relance SMS à J+3 augmente la première commande.", statut: "brouillon", debut: fin, fin: null, variantes: [] },
  ];
  const incidents: Incident[] = [
    { id: "inc1", date: fin - 2 * JOUR, titre: "Latence NotchPay sur Mobile Money (CM)", gravite: "majeur", resoluLe: fin - 2 * JOUR + 3 * 3600_000 },
    { id: "inc2", date: fin - 9 * JOUR, titre: "Échec d'envoi des emails transactionnels", gravite: "mineur", resoluLe: fin - 9 * JOUR + 5400_000 },
    { id: "inc3", date: fin - 26 * JOUR, titre: "Indisponibilité du constructeur de boutique", gravite: "critique", resoluLe: fin - 26 * JOUR + 2400_000 },
    { id: "inc4", date: fin - 0.3 * JOUR, titre: "Webhooks de paiement retardés", gravite: "mineur", resoluLe: null },
  ];

  const ds: Dataset = {
    source: "demo", genereA: maintenant, manques: [], marchands,
    commandes: ok(commandes), abonnements: ok(abonnements), ia: ok(ia), fonctions: ok(fonctions),
    visites, depenses, experiences, incidents, tickets: ok(tickets),
  };
  memo = { jour: jourAncre, ds };
  return { ...ds, commandes: ds.commandes.filter((c) => c.date <= maintenant) };
}
