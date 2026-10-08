// Domaines personnalisés des boutiques (server-only).
// 1. Le marchand saisit son domaine → validé, unique, ajouté au projet Vercel
//    par l'API (le domaine doit être attaché au projet pour que Vercel route
//    le trafic et émette le certificat HTTPS).
// 2. Il crée chez son registraire les enregistrements DNS renvoyés par Vercel.
// 3. proxy.ts → slugPourDomaine() sert la boutique sur ce domaine.
// Variables : VERCEL_API_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID (si projet d'équipe).
import { prisma } from "./prisma";

const API = "https://api.vercel.com";
const DOMAINE_APP = (process.env.NEXT_PUBLIC_AXSO_DOMAIN || "").split(":")[0];

export const vercelConfigure = () => !!(process.env.VERCEL_API_TOKEN && process.env.VERCEL_PROJECT_ID);

/** "https://Boutique.MonSite.com/page" → "boutique.monsite.com" ; null si invalide ou réservé. */
export function normaliserDomaine(saisie: string): string | null {
  const d = saisie.trim().toLowerCase().replace(/^https?:\/\//, "").split(/[/?#]/)[0].replace(/:\d+$/, "").replace(/\.$/, "");
  if (!/^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(d)) return null;
  if (d.endsWith(".vercel.app") || (DOMAINE_APP && (d === DOMAINE_APP || d.endsWith(`.${DOMAINE_APP}`)))) return null;
  return d;
}

async function vercel(chemin: string, init: RequestInit = {}) {
  const equipe = process.env.VERCEL_TEAM_ID ? `${chemin.includes("?") ? "&" : "?"}teamId=${process.env.VERCEL_TEAM_ID}` : "";
  const r = await fetch(`${API}${chemin}${equipe}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`, "Content-Type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(10000),
  });
  const corps = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, corps: corps as any };
}

const projet = () => `/v10/projects/${process.env.VERCEL_PROJECT_ID}/domains`;

export async function ajouterDomaineVercel(domaine: string): Promise<{ ok: boolean; erreur?: string }> {
  const r = await vercel(projet(), { method: "POST", body: JSON.stringify({ name: domaine }) });
  const dejaSurCeProjet = r.corps?.error?.code === "domain_already_in_use_by_project" || (r.status === 409 && /this project/i.test(r.corps?.error?.message ?? ""));
  if (r.ok || dejaSurCeProjet) return { ok: true };
  return { ok: false, erreur: r.corps?.error?.message ?? `Vercel a refusé le domaine (${r.status})` };
}

export async function retirerDomaineVercel(domaine: string) {
  await vercel(`/v9/projects/${process.env.VERCEL_PROJECT_ID}/domains/${domaine}`, { method: "DELETE" }).catch(() => {});
}

export type EnregistrementDns = { type: "A" | "CNAME" | "TXT"; nom: string; valeur: string; raison: string };
export type EtatDomaine = { domaine: string; actif: boolean; verifie: boolean; dnsOk: boolean; enregistrements: EnregistrementDns[]; message?: string };

/** État réel chez Vercel + enregistrements DNS à créer. `verifier` relance la vérification de propriété. */
export async function etatDomaine(domaine: string, verifier = false): Promise<EtatDomaine> {
  if (verifier) await vercel(`/v9/projects/${process.env.VERCEL_PROJECT_ID}/domains/${domaine}/verify`, { method: "POST" });
  const [info, config] = await Promise.all([
    vercel(`/v9/projects/${process.env.VERCEL_PROJECT_ID}/domains/${domaine}`),
    vercel(`/v6/domains/${domaine}/config`),
  ]);
  if (!info.ok) return { domaine, actif: false, verifie: false, dnsOk: false, enregistrements: [], message: info.corps?.error?.message ?? "Domaine introuvable sur le projet Vercel" };
  const apex = info.corps.apexName === domaine;
  const nomLocal = apex ? "@" : domaine.slice(0, -(info.corps.apexName.length + 1));
  const enregistrements: EnregistrementDns[] = [
    apex
      ? { type: "A", nom: "@", valeur: "76.76.21.21", raison: "Dirige le domaine vers AXSO" }
      : { type: "CNAME", nom: nomLocal, valeur: "cname.vercel-dns.com", raison: "Dirige le sous-domaine vers AXSO" },
    ...((info.corps.verification ?? []) as any[]).map((v) => ({
      type: "TXT" as const, nom: v.domain.endsWith(`.${info.corps.apexName}`) ? v.domain.slice(0, -(info.corps.apexName.length + 1)) : v.domain,
      valeur: v.value, raison: "Prouve que le domaine vous appartient",
    })),
  ];
  const verifie = info.corps.verified === true;
  const dnsOk = config.ok && config.corps.misconfigured === false;
  return { domaine, actif: verifie && dnsOk, verifie, dnsOk, enregistrements };
}

// ── Routage (proxy.ts) : domaine → slug, avec cache mémoire court ──────────────
const cache = new Map<string, { slug: string | null; expire: number }>();

export async function slugPourDomaine(hote: string): Promise<string | null> {
  const domaine = hote.split(":")[0].toLowerCase();
  const c = cache.get(domaine);
  if (c && c.expire > Date.now()) return c.slug;
  const t = await prisma.tenant.findFirst({ where: { customDomain: domaine, statut: "active" }, select: { slug: true } }).catch(() => null);
  cache.set(domaine, { slug: t?.slug ?? null, expire: Date.now() + 60_000 }); // ponytail: 60 s de cache par instance ; invalidation active si besoin
  return t?.slug ?? null;
}

// ── Adresse principale (modèle Shopify) : slug → domaine personnalisé actif ────
// Un domaine ne devient principal qu'une fois confirmé actif par Vercel
// (Tenant.domaineActifAt, mis à jour par /api/domaine). Sert aux liens générés
// (QR, emails, WhatsApp, factures) et à la redirection de l'adresse AXSO (proxy.ts).
const cacheSlug = new Map<string, { domaine: string | null; expire: number }>();

export async function domainePrincipal(slug: string): Promise<string | null> {
  const c = cacheSlug.get(slug);
  if (c && c.expire > Date.now()) return c.domaine;
  const t = await prisma.tenant.findFirst({
    where: { slug, statut: "active", customDomain: { not: null }, domaineActifAt: { not: null } },
    select: { customDomain: true },
  }).catch(() => null);
  cacheSlug.set(slug, { domaine: t?.customDomain ?? null, expire: Date.now() + 60_000 });
  return t?.customDomain ?? null;
}

/** À appeler après tout changement de domaine (sur cette instance ; les autres expirent en 60 s). */
export function oublierDomaine(slug: string, domaine?: string | null) {
  cacheSlug.delete(slug);
  if (domaine) cache.delete(domaine);
}
