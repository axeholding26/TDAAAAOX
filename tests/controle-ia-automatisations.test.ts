// AXSO CONTROL — automatisations et webhooks : ce qui doit rester vrai sans base de données.
// Une automatisation agit seule : sa définition est bornée, elle ne boucle pas, et un webhook
// ne peut pas viser le réseau interne.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PLAFONDS, conditionsVraies, evaluerCondition, lire, prochaineExecution, refusDeLancer, resoudre, validerDefinition,
  type Declencheur, type NatureOutil,
} from "@/lib/controle-ia/automatisations";
import { adresseInterdite, refusUrlWebhook, signerWebhook } from "@/lib/controle-ia/evenements";

const ctx = { evenement: { stock: 3, seuil: 5, nom: "Savon noir", tags: ["bio", "promo"], vide: "" }, etapes: { "0": { succes: true, resultat: "2 fournisseurs", donnees: { total: 2, meilleur: { prix: 1500 } } } } };

test("conditions : comparaisons simples sur l'événement et sur le résultat des étapes", () => {
  assert.equal(evaluerCondition({ champ: "stock", op: "<", valeur: 5 }, ctx), true);
  assert.equal(evaluerCondition({ champ: "evenement.stock", op: ">=", valeur: "3" }, ctx), true);
  assert.equal(evaluerCondition({ champ: "stock", op: "<", valeur: "{{seuil}}" }, ctx), true); // « stock < seuil »
  assert.equal(evaluerCondition({ champ: "etapes.0.donnees.meilleur.prix", op: "<=", valeur: 2000 }, ctx), true);
  assert.equal(evaluerCondition({ champ: "nom", op: "contient", valeur: "savon" }, ctx), true);
  assert.equal(evaluerCondition({ champ: "tags", op: "contient", valeur: "promo" }, ctx), true);
  assert.equal(evaluerCondition({ champ: "nom", op: "=", valeur: "Savon noir" }, ctx), true);
  assert.equal(evaluerCondition({ champ: "stock", op: "!=", valeur: 3 }, ctx), false);
  assert.equal(evaluerCondition({ champ: "stock", op: "existe" }, ctx), true);
  assert.equal(evaluerCondition({ champ: "vide", op: "existe" }, ctx), false);
  assert.equal(conditionsVraies([{ champ: "stock", op: "<", valeur: 5 }, { champ: "etapes.0.donnees.total", op: ">", valeur: 2 }], ctx), false);
  assert.equal(conditionsVraies([], ctx), true);
});

test("conditions : une donnée absente ou non numérique ne remplit jamais une comparaison d'ordre", () => {
  assert.equal(evaluerCondition({ champ: "inconnu", op: "<", valeur: 5 }, ctx), false);
  assert.equal(evaluerCondition({ champ: "inconnu", op: ">=", valeur: 0 }, ctx), false);
  assert.equal(evaluerCondition({ champ: "nom", op: ">", valeur: 1 }, ctx), false);
  assert.equal(evaluerCondition({ champ: "vide", op: "<", valeur: 5 }, ctx), false); // "" ne vaut pas 0
  // les chemins ne sortent pas des données : ni prototype, ni constructeur
  assert.equal(lire(ctx, "__proto__.polluted"), undefined);
  assert.equal(lire(ctx, "etapes.constructor.name"), undefined);
});

test("arguments : « {{chemin}} » seul garde le type, au milieu d'un texte il est écrit", () => {
  assert.deepEqual(resoudre({ quantite: "{{seuil}}", note: "Stock de {{nom}} : {{stock}}", liste: ["{{etapes.0.donnees.total}}"], fixe: 7, absent: "{{rien}}" }, ctx),
    { quantite: 5, note: "Stock de Savon noir : 3", liste: [2], fixe: 7, absent: null });
});

const horaire = (d: Partial<Extract<Declencheur, { type: "horaire" }>>) => ({ type: "horaire", frequence: "jour", heure: "08:00", fuseau: "Africa/Douala", ...d }) as Extract<Declencheur, { type: "horaire" }>;
const prochaine = (d: Parameters<typeof horaire>[0], apres: string) => prochaineExecution(horaire(d), new Date(apres)).toISOString();

test("horaire : chaque jour à l'heure de la boutique, strictement après maintenant", () => {
  // Douala = UTC+1 : 08:00 locales = 07:00 UTC
  assert.equal(prochaine({}, "2026-10-12T06:30:00Z"), "2026-10-12T07:00:00.000Z");
  assert.equal(prochaine({}, "2026-10-12T07:00:00Z"), "2026-10-13T07:00:00.000Z");
  assert.equal(prochaine({ fuseau: "Africa/Dakar" }, "2026-10-12T07:30:00Z"), "2026-10-12T08:00:00.000Z");
});

test("horaire : chaque lundi 08:00, y compris quand le lundi local tombe un autre jour en UTC", () => {
  const lundi = { frequence: "semaine", jour: 1 } as const;
  // 2026-10-12 est un lundi
  assert.equal(prochaine(lundi, "2026-10-12T06:00:00Z"), "2026-10-12T07:00:00.000Z");
  assert.equal(prochaine(lundi, "2026-10-12T07:00:00Z"), "2026-10-19T07:00:00.000Z");
  assert.equal(prochaine(lundi, "2026-10-15T12:00:00Z"), "2026-10-19T07:00:00.000Z");
  // Auckland (UTC+13) : lundi 08:00 = dimanche 19:00 UTC
  assert.equal(prochaine({ ...lundi, fuseau: "Pacific/Auckland" }, "2026-10-11T12:00:00Z"), "2026-10-11T19:00:00.000Z");
  assert.equal(prochaine({ ...lundi, fuseau: "Pacific/Auckland" }, "2026-10-11T19:00:00Z"), "2026-10-18T19:00:00.000Z");
  // Los Angeles (UTC-7) : lundi 23:30 = mardi 06:30 UTC
  assert.equal(prochaine({ ...lundi, heure: "23:30", fuseau: "America/Los_Angeles" }, "2026-10-12T12:00:00Z"), "2026-10-13T06:30:00.000Z");
});

test("horaire : l'heure locale tient au changement d'heure", () => {
  // Paris passe de UTC+2 à UTC+1 le 25 octobre 2026 : 08:00 = 06:00 UTC la veille, 07:00 UTC ensuite
  assert.equal(prochaine({ fuseau: "Europe/Paris" }, "2026-10-23T12:00:00Z"), "2026-10-24T06:00:00.000Z");
  assert.equal(prochaine({ fuseau: "Europe/Paris" }, "2026-10-24T12:00:00Z"), "2026-10-25T07:00:00.000Z");
});

const NATURES: Record<string, NatureOutil> = { find_suppliers: "lecture", compare_suppliers: "lecture", create_purchase_order: "ecriture", stats_globales: "lecture", envoyer_email_client: "ecriture", create_automation: "interdit", axso_execute_goal: "interdit" };
const nature = (o: string) => NATURES[o] ?? "inconnu";
const valider = (d: unknown) => validerDefinition(d, nature, "Africa/Douala");
const erreur = (d: unknown) => { const v = valider(d); return v.ok ? null : v.erreur; };
const outil = { type: "outil", outil: "stats_globales", args: { periode: "7j" } };
const base = { nom: "Test", declencheur: { type: "evenement", evenement: "inventory.low" }, etapes: [outil] };

test("définition : les deux exemples du cahier des charges sont acceptés et nettoyés", () => {
  const stock = valider({
    nom: "  Réassort automatique  ", declencheur: { type: "evenement", evenement: "inventory.low" }, conditions: [{ champ: "stock", op: "<", valeur: "{{seuil}}" }],
    etapes: [
      { type: "outil", outil: "find_suppliers", args: { produit: "{{nom}}" }, essais: 2 },
      { type: "branche", conditions: [{ champ: "etapes.0.donnees.total", op: ">", valeur: 0 }], sinon: "arreter" },
      { type: "outil", outil: "compare_suppliers", args: {} },
      { type: "accord", outil: "create_purchase_order", args: { produitId: "{{produitId}}" }, inconnu: "ignoré" },
    ],
  });
  assert.equal(stock.ok, true);
  if (stock.ok) {
    assert.equal(stock.valeur.nom, "Réassort automatique");
    assert.deepEqual(stock.valeur.etapes[3], { type: "accord", outil: "create_purchase_order", args: { produitId: "{{produitId}}" } });
  }
  const lundi = valider({ nom: "Rapport du lundi", declencheur: { type: "horaire", frequence: "semaine", jour: "Lundi", heure: "08:00" }, etapes: [outil, { type: "attente", minutes: 5 }, { type: "outil", outil: "envoyer_email_client" }] });
  assert.equal(lundi.ok, true);
  // le fuseau de la boutique est posé par défaut, le jour devient un numéro
  if (lundi.ok) assert.deepEqual(lundi.valeur.declencheur, { type: "horaire", frequence: "semaine", heure: "08:00", jour: 1, fuseau: "Africa/Douala" });
});

test("définition : ce qui est mal formé ou hors bornes est refusé", () => {
  assert.match(erreur({ ...base, nom: "" })!, /nom/);
  assert.match(erreur({ ...base, declencheur: { type: "evenement", evenement: "order.deleted" } })!, /evenement/);
  assert.match(erreur({ ...base, declencheur: { type: "horaire", frequence: "jour", heure: "8h" } })!, /HH:MM/);
  assert.match(erreur({ ...base, declencheur: { type: "horaire", frequence: "jour", heure: "24:00" } })!, /HH:MM/);
  assert.match(erreur({ ...base, declencheur: { type: "horaire", frequence: "semaine", heure: "08:00" } })!, /jour/);
  assert.match(erreur({ ...base, declencheur: { type: "horaire", frequence: "jour", heure: "08:00", fuseau: "Mars/Olympus" } })!, /fuseau/);
  assert.match(erreur({ ...base, declencheur: { type: "horaire", frequence: "minute", heure: "08:00" } })!, /frequence/);
  assert.match(erreur({ ...base, conditions: [{ champ: "stock", op: "~", valeur: 1 }] })!, /opérateur/);
  assert.match(erreur({ ...base, conditions: [{ champ: "stock", op: "<" }] })!, /valeur/);
  assert.match(erreur({ ...base, etapes: [] })!, /etapes/);
  assert.match(erreur({ ...base, etapes: Array(PLAFONDS.etapes + 1).fill(outil) })!, /etapes/);
  assert.equal(erreur({ ...base, etapes: Array(PLAFONDS.etapes).fill(outil) }), null);
  assert.match(erreur({ ...base, etapes: [{ type: "outil", outil: "supprimer_la_base" }] })!, /n'existe pas/);
  assert.match(erreur({ ...base, etapes: [{ ...outil, essais: 10 }] })!, /essais/);
  assert.match(erreur({ ...base, etapes: [{ type: "attente", minutes: 0 }, outil] })!, /minutes/);
  assert.match(erreur({ ...base, etapes: [{ type: "attente", minutes: 5 }] })!, /au moins un outil/);
  assert.match(erreur({ ...base, etapes: [{ type: "accord", outil: "stats_globales" }] })!, /pas d'accord/);
  assert.match(erreur({ ...base, etapes: [{ type: "script", code: "…" }] })!, /type/);
});

test("anti-boucle : pas d'outil d'automatisation en étape, pas de saut en arrière, pas de cascade", () => {
  // une automatisation ne crée ni ne lance une automatisation ou un objectif
  assert.match(erreur({ ...base, etapes: [{ type: "outil", outil: "create_automation", args: base }] })!, /ne peut pas être une étape/);
  assert.match(erreur({ ...base, etapes: [{ type: "accord", outil: "axso_execute_goal" }] })!, /ne peut pas être une étape/);
  // une branche ne revient pas en arrière (ni sur elle-même) : le déroulé finit toujours
  const branche = (sinon: unknown) => erreur({ ...base, etapes: [outil, { type: "branche", conditions: [{ champ: "stock", op: "<", valeur: 1 }], sinon }, outil, outil] });
  assert.match(branche(1)!, /sinon/);
  assert.match(branche(2)!, /sinon/);
  assert.match(branche(5)!, /sinon/);
  assert.equal(branche(4), null);
  assert.equal(branche("arreter"), null);
  // un événement provoqué par une étape d'automatisation n'en déclenche aucune
  assert.notEqual(refusDeLancer({ provoquePar: "auto_1", lancementsHeure: 0 }), null);
  assert.equal(refusDeLancer({ provoquePar: null, lancementsHeure: 0 }), null);
  // et le nombre de déclenchements par heure est plafonné quoi qu'il arrive
  assert.equal(refusDeLancer({ lancementsHeure: PLAFONDS.parHeure - 1 }), null);
  assert.notEqual(refusDeLancer({ lancementsHeure: PLAFONDS.parHeure }), null);
});

test("webhooks : seules les adresses https publiques sont acceptées (SSRF)", () => {
  for (const url of ["https://erp.exemple.com/axso", "https://hooks.exemple.com:443/a?b=c", "https://8.8.8.8/hook", "https://[2606:4700:4700::1111]/hook"]) assert.equal(refusUrlWebhook(url), null, url);
  for (const url of [
    "http://erp.exemple.com/axso", "ftp://exemple.com", "javascript:alert(1)", "pas une adresse", "", null, 42,
    "https://user:pass@exemple.com/", "https://exemple.com:8443/",
    "https://localhost/", "https://LOCALHOST./", "https://intranet/", "https://api.internal/", "https://imprimante.local/",
    "https://127.0.0.1/", "https://127.1/", "https://0x7f.0.0.1/", "https://2130706433/", "https://0.0.0.0/",
    "https://10.0.0.5/", "https://172.16.0.1/", "https://172.31.255.255/", "https://192.168.1.1/", "https://100.64.0.1/",
    "https://169.254.169.254/latest/meta-data/", "https://[::1]/", "https://[::]/", "https://[fd00:ec2::254]/", "https://[fe80::1]/",
    "https://[::ffff:127.0.0.1]/", "https://[::ffff:169.254.169.254]/", "https://[64:ff9b::7f00:1]/",
    `https://exemple.com/${"a".repeat(600)}`,
  ]) assert.notEqual(refusUrlWebhook(url), null, String(url));
});

test("webhooks : les adresses obtenues par DNS sont filtrées, et la signature couvre l'horodatage", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.0.10", "169.254.169.254", "100.100.100.200", "0.0.0.0", "224.0.0.1", "255.255.255.255", "::1", "::", "fc00::1", "fd00:ec2::254", "fe80::1", "ff02::1", "::ffff:10.0.0.1", "2002:7f00:1::", "pas-une-ip"]) assert.equal(adresseInterdite(ip), true, ip);
  for (const ip of ["8.8.8.8", "172.32.0.1", "196.200.1.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"]) assert.equal(adresseInterdite(ip), false, ip);
  assert.match(signerWebhook("whsec_x", 1_800_000_000, "{}"), /^[0-9a-f]{64}$/);
  assert.notEqual(signerWebhook("whsec_x", 1_800_000_000, "{}"), signerWebhook("whsec_x", 1_800_000_001, "{}"));
  assert.notEqual(signerWebhook("whsec_x", 1_800_000_000, "{}"), signerWebhook("whsec_y", 1_800_000_000, "{}"));
});
