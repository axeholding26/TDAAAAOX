// Communauté d'un produit + mentorat. Identité : jeton personnel (en-tête x-acces) ou session
// marchande (formateur). Droits : lib/live/regles.ts → peutCommunaute.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { membreOuRefus, espaceDuProduit } from "@/lib/live/communaute";
import { peutCommunaute, SEUIL_MASQUAGE, type ActionCommunaute } from "@/lib/live/regles";
import { lienValide } from "@/lib/live/visio";

type Ctx = { params: Promise<{ produitId: string }> };
const limite = rateLimit({ windowMs: 60_000, max: 40, keyPrefix: "communaute" });
const id = z.string().min(1).max(40);
const texte = (max: number) => z.string().trim().min(1).max(max);

const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("fil"), type: z.enum(["discussion", "question", "annonce"]), titre: texte(160), texte: texte(5000) }),
  z.object({ action: z.literal("repondre"), filId: id, texte: texte(5000) }),
  z.object({ action: z.literal("reagir"), messageId: id, emoji: z.enum(["👍", "❤️", "🎉", "🙏", "💡"]) }),
  z.object({ action: z.literal("signaler"), messageId: id, raison: z.string().trim().max(300).optional() }),
  z.object({ action: z.literal("resoudre"), filId: id, resolu: z.boolean() }),
  z.object({ action: z.literal("masquer"), messageId: id.optional(), filId: id.optional(), masque: z.boolean() }),
  z.object({ action: z.literal("epingler"), filId: id, epingle: z.boolean() }),
  z.object({ action: z.literal("regles"), regles: z.string().max(5000), actif: z.boolean().optional() }),
  z.object({ action: z.literal("mentor"), inscriptionId: id, mentor: z.boolean() }),
  z.object({ action: z.literal("creneau"), mentorNom: texte(80), debut: z.string().datetime(), dureeMin: z.number().int().min(10).max(240), lien: z.string().url().max(500).optional() }),
  z.object({ action: z.literal("supprimer_creneau"), creneauId: id }),
  z.object({ action: z.literal("reserver"), creneauId: id }),
]);

const DROIT: Record<z.infer<typeof Action>["action"], ActionCommunaute> = {
  fil: "ecrire", repondre: "repondre", reagir: "reagir", signaler: "signaler", resoudre: "resoudre", masquer: "moderer",
  epingler: "epingler", regles: "regles", mentor: "moderer", creneau: "creneau", supprimer_creneau: "creneau", reserver: "reserver",
};

export async function GET(req: NextRequest, { params }: Ctx) {
  const rl = limite.check(getClientIp(req));
  if (!rl.success) return rateLimitResponse(rl.reset);
  const { produitId } = await params;
  const m = await membreOuRefus(produitId, req.headers.get("x-acces"), false);
  if (m instanceof NextResponse) return m;
  const espace = await espaceDuProduit(produitId, m.tenantId);
  if (!peutCommunaute(m.role, "lire", espace.actif)) return NextResponse.json({ error: "Communauté fermée" }, { status: 403 });
  const moderateur = m.role === "formateur";
  const [fils, creneaux] = await Promise.all([
    prisma.filCommunaute.findMany({
      where: { espaceId: espace.id, ...(moderateur ? {} : { masque: false }) },
      orderBy: [{ epingle: "desc" }, { updatedAt: "desc" }], take: 50,
      include: { messages: { where: moderateur ? {} : { masque: false }, orderBy: { createdAt: "asc" }, take: 200, include: { reactions: { select: { emoji: true, auteurCle: true } } } } },
    }),
    prisma.creneauMentorat.findMany({ where: { produitId, debut: { gte: new Date(Date.now() - 86_400_000) } }, orderBy: { debut: "asc" }, take: 100 }),
  ]);
  // Ne jamais exposer les e-mails des autres membres : seul « c'est moi » est transmis.
  const nettoie = (cle: string) => ({ moi: cle === m.cle });
  return NextResponse.json({
    moi: { role: m.role, nom: m.nom },
    espace: { regles: espace.regles, actif: espace.actif },
    fils: fils.map(({ auteurCle, messages, ...f }) => ({
      ...f, ...nettoie(auteurCle),
      messages: messages.map(({ auteurCle: a, reactions, ...msg }) => ({
        ...msg, ...nettoie(a),
        reactions: Object.entries(reactions.reduce<Record<string, { n: number; moi: boolean }>>((acc, r) => {
          acc[r.emoji] ??= { n: 0, moi: false }; acc[r.emoji].n++; if (r.auteurCle === m.cle) acc[r.emoji].moi = true; return acc;
        }, {})).map(([emoji, v]) => ({ emoji, ...v })),
        ...(moderateur ? {} : { signalements: undefined }),
      })),
    })),
    creneaux: creneaux.map(({ reserveCle, lien, ...c }) => ({
      ...c, reserve: !!reserveCle, moi: reserveCle === m.cle,
      // Le lien du créneau n'est donné qu'à celui qui l'a réservé (et au formateur).
      lien: moderateur || reserveCle === m.cle ? lien : null,
      reserveNom: moderateur ? c.reserveNom : null,
    })),
  });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const rl = limite.check(getClientIp(req));
  if (!rl.success) return rateLimitResponse(rl.reset);
  const { produitId } = await params;
  const corps = Action.safeParse(await req.json().catch(() => null));
  if (!corps.success) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  const a = corps.data;
  const m = await membreOuRefus(produitId, req.headers.get("x-acces"), true);
  if (m instanceof NextResponse) return m;
  const espace = await espaceDuProduit(produitId, m.tenantId);
  if (!peutCommunaute(m.role, DROIT[a.action], espace.actif) || (a.action === "fil" && a.type === "annonce" && !peutCommunaute(m.role, "annonce"))) {
    return NextResponse.json({ error: "Action non autorisée pour votre rôle" }, { status: 403 });
  }
  const auteur = { auteurCle: m.cle, auteurNom: m.nom.slice(0, 80), auteurRole: m.role };
  // Toute cible doit appartenir à CET espace (pas d'action sur la communauté d'une autre boutique).
  const filDeLEspace = (filId: string) => prisma.filCommunaute.findFirst({ where: { id: filId, espaceId: espace.id }, select: { id: true, masque: true } });
  const messageDeLEspace = (messageId: string) => prisma.messageCommunaute.findFirst({ where: { id: messageId, fil: { espaceId: espace.id } }, select: { id: true, masque: true } });
  const introuvable = NextResponse.json({ error: "Introuvable" }, { status: 404 });

  switch (a.action) {
    case "fil": {
      const fil = await prisma.filCommunaute.create({ data: { espaceId: espace.id, type: a.type, titre: a.titre, ...auteur, epingle: a.type === "annonce", messages: { create: { ...auteur, texte: a.texte } } } });
      return NextResponse.json({ ok: true, id: fil.id }, { status: 201 });
    }
    case "repondre": {
      const fil = await filDeLEspace(a.filId);
      if (!fil || fil.masque) return introuvable;
      await prisma.$transaction([prisma.messageCommunaute.create({ data: { filId: fil.id, ...auteur, texte: a.texte } }), prisma.filCommunaute.update({ where: { id: fil.id }, data: { updatedAt: new Date() } })]);
      return NextResponse.json({ ok: true }, { status: 201 });
    }
    case "reagir": {
      if (!(await messageDeLEspace(a.messageId))) return introuvable;
      const cle = { messageId_auteurCle_emoji: { messageId: a.messageId, auteurCle: m.cle, emoji: a.emoji } };
      const deja = await prisma.reactionCommunaute.findUnique({ where: cle });
      if (deja) await prisma.reactionCommunaute.delete({ where: cle });
      else await prisma.reactionCommunaute.create({ data: { messageId: a.messageId, auteurCle: m.cle, emoji: a.emoji } }).catch(() => null);
      return NextResponse.json({ ok: true });
    }
    case "signaler": {
      if (!(await messageDeLEspace(a.messageId))) return introuvable;
      const cree = await prisma.signalementCommunaute.create({ data: { messageId: a.messageId, auteurCle: m.cle, raison: a.raison || null } }).catch(() => null);
      if (cree) {
        const msg = await prisma.messageCommunaute.update({ where: { id: a.messageId }, data: { signalements: { increment: 1 } } });
        // Masquage automatique au-delà du seuil : le formateur tranche ensuite.
        if (msg.signalements >= SEUIL_MASQUAGE) await prisma.messageCommunaute.update({ where: { id: msg.id }, data: { masque: true } });
      }
      return NextResponse.json({ ok: true });
    }
    case "resoudre": {
      if (!(await filDeLEspace(a.filId))) return introuvable;
      await prisma.filCommunaute.update({ where: { id: a.filId }, data: { resolu: a.resolu } });
      return NextResponse.json({ ok: true });
    }
    case "masquer": {
      if (a.messageId) {
        if (!(await messageDeLEspace(a.messageId))) return introuvable;
        await prisma.messageCommunaute.update({ where: { id: a.messageId }, data: { masque: a.masque, ...(a.masque ? {} : { signalements: 0 }) } });
        if (!a.masque) await prisma.signalementCommunaute.deleteMany({ where: { messageId: a.messageId } });
      } else if (a.filId) {
        if (!(await filDeLEspace(a.filId))) return introuvable;
        await prisma.filCommunaute.update({ where: { id: a.filId }, data: { masque: a.masque } });
      }
      return NextResponse.json({ ok: true });
    }
    case "epingler": {
      if (!(await filDeLEspace(a.filId))) return introuvable;
      await prisma.filCommunaute.update({ where: { id: a.filId }, data: { epingle: a.epingle } });
      return NextResponse.json({ ok: true });
    }
    case "regles":
      await prisma.espaceCommunaute.update({ where: { id: espace.id }, data: { regles: a.regles || null, ...(a.actif === undefined ? {} : { actif: a.actif }) } });
      return NextResponse.json({ ok: true });
    case "mentor": {
      const { count } = await prisma.inscriptionLive.updateMany({
        where: { id: a.inscriptionId, tenantId: m.tenantId, OR: [{ evenement: { produitId } }, { bootcamp: { produitId } }] },
        data: { role: a.mentor ? "mentor" : "apprenant" },
      });
      return count ? NextResponse.json({ ok: true }) : introuvable;
    }
    case "creneau": {
      if (a.lien && !lienValide(a.lien)) return NextResponse.json({ error: "Lien https requis" }, { status: 400 });
      const c = await prisma.creneauMentorat.create({ data: { tenantId: m.tenantId, produitId, mentorNom: a.mentorNom, debut: new Date(a.debut), dureeMin: a.dureeMin, lien: a.lien || null } });
      return NextResponse.json({ ok: true, id: c.id }, { status: 201 });
    }
    case "supprimer_creneau":
      await prisma.creneauMentorat.deleteMany({ where: { id: a.creneauId, produitId, tenantId: m.tenantId } });
      return NextResponse.json({ ok: true });
    case "reserver": {
      // Prise conditionnelle : un créneau n'est jamais réservé deux fois ; un seul créneau à venir par apprenant.
      const aVenir = await prisma.creneauMentorat.count({ where: { produitId, reserveCle: m.cle, debut: { gte: new Date() } } });
      if (aVenir) return NextResponse.json({ error: "Vous avez déjà un créneau à venir" }, { status: 409 });
      const { count } = await prisma.creneauMentorat.updateMany({
        where: { id: a.creneauId, produitId, reserveCle: null, debut: { gt: new Date() } },
        data: { reserveCle: m.cle, reserveNom: m.nom, reserveAt: new Date() },
      });
      return count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Créneau déjà pris ou passé" }, { status: 409 });
    }
  }
}
