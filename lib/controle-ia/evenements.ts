// AXSO CONTROL — bus d'événements de la boutique et webhooks sortants.
// publier() est appelé par les services métier (commande payée, livrée, stock bas…) : il
// enregistre l'événement, déclenche les automatisations abonnées (lib/controle-ia/automatisations.ts)
// et prévient les services externes abonnés (WebhookIA). Il ne bloque ni ne casse jamais
// l'appelant : tout part après la réponse, et toute erreur est avalée ici.
import { AsyncLocalStorage } from "node:async_hooks";
import { createHmac } from "node:crypto";
import { lookup } from "node:dns";
import https from "node:https";
import { BlockList, isIP } from "node:net";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifierMarchand } from "@/lib/notifications-marchand";

export const TYPES_EVENEMENT = [
  "order.created", "order.paid", "order.fulfilled", "product.created", "product.updated", "inventory.low",
  "campaign.completed", "creative.ready", "supplier.updated", "payment.completed",
  // Builder (lib/builder)
  "store.updated", "page.updated", "section.created", "section.updated", "theme.updated", "asset.created",
  "preview.created", "publish.started", "publish.completed", "publish.failed", "rollback.completed",
] as const;
export type TypeEvenement = (typeof TYPES_EVENEMENT)[number];
export const estTypeEvenement = (t: unknown): t is TypeEvenement => TYPES_EVENEMENT.includes(t as TypeEvenement);

/**
 * Automatisation en train d'exécuter une étape (posé par le moteur). Un événement publié
 * pendant ce temps est « provoqué » par elle : il ne déclenche aucune automatisation.
 */
export const automatisationEnCours = new AsyncLocalStorage<string>();

/**
 * Publie un événement de la boutique. Ne renvoie rien, n'attend rien, ne lève jamais :
 * un bus en panne ne doit pas faire échouer une commande ou un paiement.
 */
export function publier(tenantId: string, type: TypeEvenement, donnees: Record<string, unknown> = {}): void {
  try {
    // Lu tout de suite : au moment où le travail différé s'exécute, on n'est plus dans l'étape qui a provoqué l'événement.
    const provoquePar = automatisationEnCours.getStore() ?? null;
    const travail = () => diffuser(tenantId, type, donnees, provoquePar).catch((e) => console.warn("[evenements]", type, String(e?.message).slice(0, 200)));
    // Hors d'une requête (tests, script), after() n'existe pas : on lance sans attendre.
    try { after(travail); } catch { void travail(); }
  } catch { /* jamais vers l'appelant */ }
}

async function diffuser(tenantId: string, type: TypeEvenement, donnees: Record<string, unknown>, provoquePar: string | null) {
  const evt = await prisma.evenementIA.create({ data: { tenantId, type, donnees: donnees as any } });
  // Import dynamique : le moteur importe ce fichier (et, plus loin, serveur.ts qui importe les modules).
  const r = await Promise.allSettled([
    import("./automatisations").then((m) => m.declencherParEvenement(tenantId, type, donnees, provoquePar)),
    livrerAuxWebhooks(tenantId, { id: evt.id, type, createdAt: evt.createdAt, donnees }),
  ]);
  for (const x of r) if (x.status === "rejected") console.warn("[evenements]", type, String(x.reason?.message).slice(0, 200));
}

// ─── Webhooks sortants ───────────────────────────────────────────────────────
export const WEBHOOKS_MAX = 5;
const ESSAIS = 3, DELAI_MS = 5000, PAUSES_MS = [500, 2000], ECHECS_MAX = 5;

// Réseaux où un webhook ne doit jamais arriver : boucle locale, réseaux privés, lien local
// (dont les métadonnées cloud 169.254.169.254 et fd00:ec2::254), CGNAT, multidiffusion, réservés.
const INTERDITES = new BlockList();
for (const [reseau, prefixe] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 3],
] as const) INTERDITES.addSubnet(reseau, prefixe, "ipv4");
// 64:ff9b::/96 (NAT64) et 2002::/16 (6to4) transportent une adresse IPv4 : refusés en bloc.
// Les adresses IPv4 « mappées » (::ffff:a.b.c.d) sont comparées aux règles IPv4 par BlockList.
for (const [reseau, prefixe] of [["::", 127], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8], ["64:ff9b::", 96], ["2002::", 16]] as const) INTERDITES.addSubnet(reseau, prefixe, "ipv6");

/** Vrai si l'adresse IP n'est pas une adresse publique joignable (ou n'est pas une adresse IP). */
export function adresseInterdite(ip: string): boolean {
  const famille = isIP(ip);
  return famille === 0 || INTERDITES.check(ip, famille === 6 ? "ipv6" : "ipv4");
}

/** Raison du refus d'une adresse de webhook, ou null si elle est acceptable (avant résolution DNS). */
export function refusUrlWebhook(url: unknown): string | null {
  if (typeof url !== "string" || url.length > 500) return "adresse absente ou trop longue";
  let u: URL;
  try { u = new URL(url); } catch { return "adresse illisible"; }
  if (u.protocol !== "https:") return "seul https est accepté";
  if (u.username || u.password) return "pas d'identifiants dans l'adresse";
  if (u.port && u.port !== "443") return "seul le port 443 est accepté";
  // URL normalise déjà les écritures détournées d'une IPv4 (0x7f.1, 2130706433…).
  const hote = u.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (isIP(hote)) return adresseInterdite(hote) ? "adresse interne ou réservée" : null;
  if (!hote.includes(".") || /(^|\.)(localhost|local|internal|lan|home|intranet|corp)$/.test(hote)) return "nom de machine interne";
  return null;
}

/** Signature d'une livraison : HMAC-SHA256 de « horodatage.corps » (l'horodatage signé empêche le rejeu). */
export const signerWebhook = (secret: string, horodatage: number, corps: string) =>
  createHmac("sha256", secret).update(`${horodatage}.${corps}`).digest("hex");

function envoyer(url: string, corps: string, entetes: Record<string, string>): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      // https.request ne suit pas les redirections : une réponse 3xx est un échec.
      const req = https.request(url, {
        method: "POST", headers: entetes, agent: false, signal: AbortSignal.timeout(DELAI_MS),
        // Contrôle fait à la connexion, sur les adresses réellement utilisées : un nom qui
        // se met à pointer vers le réseau interne après l'enregistrement (DNS rebinding) est refusé.
        lookup: (hote, options, cb) => lookup(hote, { ...options, all: true }, (err, adresses) => {
          if (err || !adresses.length) return cb(err ?? new Error("DNS"), "", 0);
          if (adresses.some((a) => adresseInterdite(a.address))) return cb(new Error("adresse interdite"), "", 0);
          return (options as { all?: boolean }).all ? (cb as any)(null, adresses) : cb(null, adresses[0].address, adresses[0].family);
        }),
      }, (res) => { res.resume(); resolve((res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300); });
      req.on("error", () => resolve(false));
      req.end(corps);
    } catch { resolve(false); }
  });
}

interface Evenement { id: string; type: string; createdAt: Date; donnees: Record<string, unknown> }

async function livrer(w: { id: string; tenantId: string; url: string; secret: string; echecs: number }, evt: Evenement) {
  const corps = JSON.stringify({ id: evt.id, type: evt.type, created_at: evt.createdAt.toISOString(), data: evt.donnees });
  // ponytail: les essais se suivent dans la même exécution (quelques secondes) ; file de reprise si une livraison doit survivre à une panne longue.
  for (let essai = 0; essai < ESSAIS; essai++) {
    if (essai) await new Promise((r) => setTimeout(r, PAUSES_MS[essai - 1]));
    const horodatage = Math.floor(Date.now() / 1000);
    const ok = !refusUrlWebhook(w.url) && await envoyer(w.url, corps, {
      "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(corps)), "User-Agent": "Axso-Webhooks/1",
      "X-Axso-Event": evt.type, "X-Axso-Delivery": evt.id, "X-Axso-Timestamp": String(horodatage),
      "X-Axso-Signature": `sha256=${signerWebhook(w.secret, horodatage, corps)}`,
    });
    if (ok) {
      if (w.echecs) await prisma.webhookIA.updateMany({ where: { id: w.id }, data: { echecs: 0 } });
      return;
    }
  }
  const { echecs } = await prisma.webhookIA.update({ where: { id: w.id }, data: { echecs: { increment: 1 } }, select: { echecs: true } });
  if (echecs < ECHECS_MAX) return;
  // Trop d'événements perdus d'affilée : on arrête d'envoyer des données à une adresse qui ne répond plus.
  await prisma.webhookIA.updateMany({ where: { id: w.id }, data: { actif: false } });
  await notifierMarchand({
    tenantId: w.tenantId, type: "webhook_desactive", titre: "Webhook désactivé",
    message: `${new URL(w.url).hostname} n'a pas répondu à ${ECHECS_MAX} événements de suite : l'envoi est arrêté.`, lien: "/dashboard/controle-ia",
  });
}

async function livrerAuxWebhooks(tenantId: string, evt: Evenement) {
  const abonnes = await prisma.webhookIA.findMany({ where: { tenantId, actif: true, evenements: { has: evt.type } } });
  await Promise.allSettled(abonnes.map((w) => livrer(w, evt)));
}
