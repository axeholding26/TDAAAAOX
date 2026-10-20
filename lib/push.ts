// NOTIFICATIONS PUSH (Web Push, clés VAPID) : chaque notification d'Axso part aussi vers les
// appareils abonnés et s'affiche comme une notification du téléphone ou de l'ordinateur, même
// onglet ou appli fermés (affichage : public/sw.js). Trois espaces : dashboard (boutiques du
// compte), admin (Command Center), livreur. Envoi au mieux : un service de push en panne ne
// bloque jamais l'action qui notifie ; un appareil désabonné (404/410) est oublié.
// Volume : le son est celui des notifications de l'appareil (réglé par l'utilisateur) ; aucune
// page web ne peut forcer le volume du système. On demande la priorité haute (réveil immédiat).
import webpush from "web-push";
import { after } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { estRoleAdmin, peutVoir } from "@/lib/command-center/rbac";

export type Espace = "dashboard" | "admin" | "livreur";
export const ESPACES: Espace[] = ["dashboard", "admin", "livreur"];
export interface MessagePush { titre: string; message: string; lien?: string | null; type?: string }

const ACCUEIL: Record<Espace, string> = { dashboard: "/dashboard", admin: "/admin", livreur: "/livreur" };
// Restent à l'écran jusqu'à ce qu'on les touche : ce qui demande une action rapide.
const URGENTS = new Set(["nouvelle_commande", "commande_whatsapp", "escalade_humain", "nouvel_inscrit", "course_retiree", "nouvelle_livraison", "retrait_a_valider"]);

export const clePubliqueVapid = () => process.env.VAPID_PUBLIC_KEY || null;

let pret = false;
function configurer(): boolean {
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  if (!pret) { webpush.setVapidDetails(process.env.VAPID_SUJET || "https://axsoafrica.com", pub, priv); pret = true; }
  return true;
}

/** Ce que lit public/sw.js. Lien : chemin du site seulement (jamais une adresse externe). */
export function chargeUtile(m: MessagePush, espace: Espace): string {
  const lien = m.lien && /^\/(?!\/)/.test(m.lien) ? m.lien : ACCUEIL[espace];
  return JSON.stringify({ titre: m.titre.slice(0, 120), message: m.message.slice(0, 300), lien, tag: `${m.type ?? "axso"}-${Date.now()}`, urgent: URGENTS.has(m.type ?? "") });
}

export interface Bilan { envoyes: number; echecs: number }

async function envoyer(where: Prisma.AbonnementPushWhereInput, m: MessagePush, filtre?: (a: { user: { role: string } }) => boolean): Promise<Bilan> {
  const bilan = { envoyes: 0, echecs: 0 };
  if (!configurer()) return bilan;
  try {
    const abonnes = (await prisma.abonnementPush.findMany({ where, include: { user: { select: { role: true } } }, take: 500 })).filter((a) => !filtre || filtre(a));
    await Promise.all(abonnes.map(async (a) => {
      try {
        // urgency high : Android réveille l'appareil tout de suite (même en veille) ; TTL 1 jour.
        await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, chargeUtile(m, a.espace as Espace), { TTL: 86_400, urgency: "high", timeout: 8000 });
        bilan.envoyes++;
        await prisma.abonnementPush.update({ where: { id: a.id }, data: { dernierEnvoi: new Date() } }).catch(() => {});
      } catch (e: any) {
        bilan.echecs++;
        if (e?.statusCode === 404 || e?.statusCode === 410) await prisma.abonnementPush.delete({ where: { id: a.id } }).catch(() => {});
        else console.warn(JSON.stringify({ evt: "push_echec", statut: e?.statusCode ?? null, message: String(e?.message ?? e).slice(0, 150) }));
      }
    }));
  } catch (e: any) {
    console.warn(JSON.stringify({ evt: "push_echec", message: String(e?.message ?? e).slice(0, 150) }));
  }
  return bilan;
}

/** Comptes qui voient ces boutiques dans leur tableau de bord (propriétaires et équipe active) : comme la cloche. */
async function comptesDesBoutiques(tenantIds: string[]): Promise<string[]> {
  const [proprios, membres] = await Promise.all([
    prisma.proprietaireBoutique.findMany({ where: { tenantId: { in: tenantIds } }, select: { userId: true } }),
    prisma.membreEquipe.findMany({ where: { tenantId: { in: tenantIds }, statut: "actif", userId: { not: null } }, select: { userId: true } }),
  ]);
  return [...new Set([...proprios, ...membres].map((x) => x.userId!).filter(Boolean))];
}

export async function pousserMarchands(tenantIds: string[], m: MessagePush): Promise<Bilan> {
  const userIds = await comptesDesBoutiques(tenantIds).catch(() => []);
  return userIds.length ? envoyer({ espace: "dashboard", userId: { in: userIds } }, m) : { envoyes: 0, echecs: 0 };
}

/** Command Center : admins qui ont le droit de voir les marchands (même règle que l'alerte sonore). */
export const pousserAdmins = (m: MessagePush) =>
  envoyer({ espace: "admin" }, m, (a) => estRoleAdmin(a.user.role) && peutVoir(a.user.role as any, "marchands"));

export async function pousserLivreur(livreurId: string, m: MessagePush): Promise<Bilan> {
  const l = await prisma.livreur.findUnique({ where: { id: livreurId }, select: { userId: true } }).catch(() => null);
  return l ? envoyer({ espace: "livreur", userId: l.userId }, m) : { envoyes: 0, echecs: 0 };
}

/**
 * Notification créée DANS une transaction : envoyée après la réponse, et seulement si la ligne
 * existe (transaction validée, jamais d'alerte pour une écriture annulée). Hors requête : rien.
 */
export function pousserApresTransaction(notificationId: string, tenantId: string, m: MessagePush) {
  try {
    after(async () => { if (await prisma.notificationMarchand.count({ where: { id: notificationId } })) await pousserMarchands([tenantId], m); });
  } catch { /* hors requête (tâche de fond, test) */ }
}

/** Notification d'essai vers les appareils de ce compte, dans cet espace. */
export const pousserTest = (userId: string, espace: Espace) =>
  envoyer({ espace, userId }, { titre: "🔔 Notifications Axso activées", message: "Vous recevrez ici vos alertes, même l'appli fermée.", lien: ACCUEIL[espace], type: "nouvelle_commande" });

/** Nouvel inscrit (marchand ou livreur) → Command Center. */
export function annoncerInscription(u: { name?: string | null; email?: string | null; role: string; tenantId?: string | null }) {
  const livreur = u.role === "livreur";
  return pousserAdmins({
    titre: livreur ? "🛵 Nouveau livreur inscrit" : "🎉 Nouveau marchand inscrit",
    message: `${u.name || u.email || "Nouveau compte"}${u.email && u.name ? ` · ${u.email}` : ""}`,
    lien: livreur ? "/admin/livreurs" : u.tenantId ? `/admin/marchands/${u.tenantId}` : "/admin/marchands",
    type: "nouvel_inscrit",
  });
}
