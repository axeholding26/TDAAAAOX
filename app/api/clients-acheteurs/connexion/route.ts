import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHash, randomBytes, randomInt } from "crypto";
import { envoyerCodeAcheteur, hasResend } from "@/lib/email";
import { cleTelephone } from "@/lib/utils";

// Espace client sans mot de passe, deux portes :
//  - lien personnel : le lien de suivi reçu après la commande (jeton secret) ouvre
//    le compte du TÉLÉPHONE de cette commande — rien à envoyer, marche sans service ;
//  - email : code à 6 chiffres reçu par email (achats digitaux, sans lien de suivi).
// Un compte ne voit que les commandes de l'identifiant prouvé — jamais email +
// téléphone mêlés (sinon commander avec son email et le numéro d'un autre
// suffirait à voir les commandes de cet autre).
// Codes stockés dans CodeVerification, préfixés par boutique pour ne jamais se
// mélanger aux codes de double authentification des marchands.
const DUREE_CODE_MS = 10 * 60 * 1000;
const MAX_ESSAIS = 5;
const MAX_CODES_PAR_HEURE = 5;

const empreinte = (code: string) => createHash("sha256").update(code + process.env.NEXTAUTH_SECRET).digest("hex");
// Colonne `code` = "<empreinte>:<essais ratés>" : le compteur limite les essais sans changer le schéma.
const lire = (v: string) => { const [h, n] = v.split(":"); return { h, essais: Number(n) || 0 }; };

const INDISPONIBLE = "L'envoi du code par email n'est pas encore disponible. Ouvrez le lien de suivi reçu sur WhatsApp après votre commande, puis « Voir toutes mes commandes ».";

const session = () => ({ token: randomBytes(32).toString("hex"), tokenExpire: new Date(Date.now() + 30 * 24 * 3600_000) });

// POST /api/clients-acheteurs/connexion
// { slug, lien }         → lien personnel (jeton du lien de suivi) : ouvre la session directement
// { slug, email }        → envoie un code par email
// { slug, email, code }  → vérifie le code, ouvre la session (token 30 jours)
export async function POST(req: Request) {
  const { slug, email: brut, code, lien } = await req.json().catch(() => ({}));
  if (!slug) return NextResponse.json({ error: "Boutique introuvable" }, { status: 400 });

  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true, nomBoutique: true } });
  if (!tenant) return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });

  if (lien) {
    // Jeton de 40 caractères aléatoires, connu du seul client (et du marchand, qui voit déjà
    // ses commandes) ; le livreur ne le reçoit jamais (voir /api/commandes/[id]).
    const commande = await prisma.commande.findFirst({ where: { tenantId: tenant.id, trackingToken: String(lien) }, select: { clientTelephone: true, clientNom: true } });
    const cle = cleTelephone(commande?.clientTelephone);
    if (!commande || cle.length < 9) return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 404 });
    // Compte téléphone : email null, telephone = clé (ses commandes sont retrouvées par elle).
    const existant = await prisma.compteAcheteur.findFirst({ where: { tenantId: tenant.id, email: null, telephone: cle }, select: { id: true } });
    const compte = existant
      ? await prisma.compteAcheteur.update({ where: { id: existant.id }, data: session() })
      : await prisma.compteAcheteur.create({ data: { tenantId: tenant.id, email: null, telephone: cle, nom: commande.clientNom || "Client", ...session() } });
    return NextResponse.json({ ok: true, token: compte.token, compte: { id: compte.id, email: null, nom: compte.nom } });
  }

  const email = String(brut ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Email invalide" }, { status: 400 });
  const id = `acheteur:${tenant.id}:${email}`;

  if (!code) {
    // Sans service d'envoi, ne pas annoncer un code qui n'arrivera jamais.
    if (!hasResend()) return NextResponse.json({ error: INDISPONIBLE, code: "envoi_indisponible" }, { status: 503 });
    const recents = await prisma.codeVerification.count({ where: { email: id, createdAt: { gt: new Date(Date.now() - 3600_000) } } });
    if (recents >= MAX_CODES_PAR_HEURE) return NextResponse.json({ error: "Trop de demandes, réessayez dans une heure" }, { status: 429 });
    const nouveau = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await prisma.codeVerification.updateMany({ where: { email: id, utilise: false }, data: { utilise: true } });
    await prisma.codeVerification.create({ data: { email: id, code: `${empreinte(nouveau)}:0`, expireAt: new Date(Date.now() + DUREE_CODE_MS) } });
    await envoyerCodeAcheteur(email, nouveau, tenant.nomBoutique);
    return NextResponse.json({ ok: true }); // même réponse que l'email ait des achats ou non
  }

  const enCours = await prisma.codeVerification.findFirst({ where: { email: id, utilise: false, expireAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  if (!enCours) return NextResponse.json({ error: "Code expiré, demandez-en un nouveau" }, { status: 401 });
  const { h, essais } = lire(enCours.code);
  if (h !== empreinte(String(code).trim())) {
    const restants = MAX_ESSAIS - essais - 1;
    await prisma.codeVerification.update({ where: { id: enCours.id }, data: restants > 0 ? { code: `${h}:${essais + 1}` } : { utilise: true } });
    return NextResponse.json({ error: restants > 0 ? "Code incorrect" : "Trop d'essais, demandez un nouveau code" }, { status: 401 });
  }
  await prisma.codeVerification.update({ where: { id: enCours.id }, data: { utilise: true } });

  const { token, tokenExpire } = session();
  const [derniere, client] = await Promise.all([
    prisma.commande.findFirst({ where: { tenantId: tenant.id, clientEmail: email }, orderBy: { createdAt: "desc" }, select: { clientNom: true, clientTelephone: true } }),
    prisma.client.findFirst({ where: { tenantId: tenant.id, email }, select: { id: true } }),
  ]);
  const compte = await prisma.compteAcheteur.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email } },
    update: { token, tokenExpire, ...(client ? { clientId: client.id } : {}) },
    create: { tenantId: tenant.id, email, nom: derniere?.clientNom || email.split("@")[0], telephone: derniere?.clientTelephone ?? null, token, tokenExpire, clientId: client?.id ?? null },
  });
  return NextResponse.json({ ok: true, token, compte: { id: compte.id, email: compte.email, nom: compte.nom } });
}
