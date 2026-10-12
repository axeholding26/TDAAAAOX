// Flux temps réel de la caisse : les événements d'EvenementPos, lus par curseur.
//
// GET /api/pos/flux?caisseId=            — SSE (text/event-stream) des événements de la caisse
//                                          et de ceux de toute la boutique.
// GET /api/pos/flux?portee=boutique      — tous les événements (supervision ; droit voir_caisse ou voir_analytics).
// GET /api/pos/flux?mode=poll&depuis=seq — repli : { evenements, curseur } en JSON, sans connexion tenue.
//
// Reprise : chaque événement porte `id: <seq>` ; à la reconnexion, EventSource
// renvoie `Last-Event-ID` et le flux reprend juste après — ni perte ni doublon.
// Sans curseur, le flux part du présent (il ne rejoue pas le passé).
// La connexion se termine d'elle-même avant l'échéance de la fonction
// (maxDuration, aussi déclarée dans vercel.json) : le client se reconnecte seul.
// EventSource ne sait pas envoyer d'en-tête : la caisse passe par `?caisseId=`,
// vérifiée par accesPos comme l'en-tête x-pos-caisse.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ENTETE_CAISSE, accesPos, droitsUtilisateur } from "@/lib/pos/acces";
import { exigerUnDroit } from "@/lib/pos/droits";
import { reponseErreurPos } from "@/lib/pos/erreurs";
import { dernierSeq, lireEvenements } from "@/lib/pos/evenements";
import { enLigne, lireCurseur, trameSse } from "@/lib/pos/scanner/regles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** La connexion se ferme proprement 30 s avant l'échéance. */
const DUREE_MS = (maxDuration - 30) * 1000;
/** Rythme de lecture de la table : la latence d'un scan téléphone → caisse reste sous la seconde. */
const PAS_MS = 800;
/** Commentaire de maintien (les intermédiaires coupent une connexion muette) et contrôle de présence. */
const MAINTIEN_MS = 15_000;

const pause = (ms: number, signal: AbortSignal) => new Promise<void>((fin) => {
  const t = setTimeout(fin, ms);
  signal.addEventListener("abort", () => { clearTimeout(t); fin(); }, { once: true });
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const entetes = new Headers(req.headers);
  const caisseDemandee = url.searchParams.get("caisseId");
  if (caisseDemandee) entetes.set(ENTETE_CAISSE, caisseDemandee);
  const ctx = await accesPos(new Request(req.url, { headers: entetes }));
  if (ctx instanceof NextResponse) return ctx;

  try {
    const boutique = url.searchParams.get("portee") === "boutique";
    // Un membre limité à certains magasins ne reçoit, en supervision, que leurs événements (et ceux sans magasin).
    let magasins: string[] = [];
    // Flux d'une caisse : réservé à ceux qui y travaillent ou la supervisent.
    if (!boutique) exigerUnDroit(ctx, "vendre", "scanner", "voir_caisse", "voir_stock", "voir_analytics", "inventaire_compter", "reception");
    if (boutique) {
      exigerUnDroit(ctx, "voir_caisse", "voir_analytics");
      magasins = ctx.appareilId ? [ctx.magasinId] : (await droitsUtilisateur(ctx.tenantId, ctx.userId))?.magasinIds ?? [];
    }
    const lire = async (apresSeq: string) => {
      const evenements = await lireEvenements({ tenantId: ctx.tenantId, caisseId: boutique ? null : ctx.caisseId, apresSeq, limite: 200 });
      return {
        // Le curseur avance sur tout ce qui a été lu, y compris ce qui est filtré.
        suivant: evenements.length ? evenements[evenements.length - 1].seq : apresSeq,
        plein: evenements.length === 200,
        evenements: magasins.length ? evenements.filter((e) => !e.magasinId || magasins.includes(e.magasinId)) : evenements,
      };
    };
    /** Le poste donne signe de vie par son flux (au plus une écriture toutes les 15 s). */
    const signalerPoste = async () => {
      if (!ctx.appareilId && !boutique) {
        await prisma.caisse.updateMany({ where: { id: ctx.caisseId, tenantId: ctx.tenantId }, data: { dernierSignalAt: new Date() } });
      }
    };

    const depart = lireCurseur(req.headers.get("last-event-id")) ?? lireCurseur(url.searchParams.get("depuis")) ?? (await dernierSeq(ctx.tenantId));

    if (url.searchParams.get("mode") === "poll") {
      const [lot] = await Promise.all([lire(depart), signalerPoste()]);
      return NextResponse.json({ evenements: lot.evenements, curseur: lot.suivant, caisseId: ctx.caisseId, serveurAt: new Date().toISOString() });
    }

    const encodeur = new TextEncoder();
    const fin = Date.now() + DUREE_MS;
    let ferme = false;

    const boucle = async (controleur: ReadableStreamDefaultController<Uint8Array>) => {
      const ecrire = (texte: string) => { try { controleur.enqueue(encodeur.encode(texte)); } catch { ferme = true; } };
      let curseur = depart;
      let dernierMaintien = 0;
      let echecs = 0;
      // Appareils de la caisse vus en ligne au contrôle précédent : un passage au silence devient `device.disconnected`.
      let presents: Map<string, string> | null = null;
      const controlerPresence = async () => {
        await signalerPoste();
        if (boutique) return;
        const appareils = await prisma.appareilPos.findMany({
          where: { tenantId: ctx.tenantId, caisseId: ctx.caisseId, statut: "actif" }, select: { id: true, nom: true, dernierSignalAt: true },
        });
        const maintenant = Date.now();
        const actuels = new Map(appareils.filter((a) => enLigne(a.dernierSignalAt, maintenant)).map((a) => [a.id, a.nom]));
        for (const [id, nom] of presents ?? []) {
          // Révoqué entre-temps : la révocation a déjà publié son propre événement.
          if (!actuels.has(id) && appareils.some((a) => a.id === id)) {
            ecrire(trameSse({ seq: null, type: "device.disconnected", magasinId: ctx.magasinId, caisseId: ctx.caisseId, payload: { appareilId: id, nom, motif: "sans_signal" }, createdAt: new Date().toISOString() }));
          }
        }
        presents = actuels;
      };

      // `retry` : délai de reconnexion du navigateur. `id` dès l'ouverture : une coupure avant le premier événement reprend au bon endroit.
      ecrire(`retry: 1500\n${trameSse({ seq: curseur, type: "pret", magasinId: ctx.magasinId, caisseId: boutique ? null : ctx.caisseId, payload: {}, createdAt: new Date().toISOString() })}`);
      while (!ferme && !req.signal.aborted && Date.now() < fin) {
        let plein = false;
        try {
          const lot = await lire(curseur);
          for (const e of lot.evenements) ecrire(trameSse(e));
          curseur = lot.suivant;
          plein = lot.plein;
          if (Date.now() - dernierMaintien > MAINTIEN_MS) {
            dernierMaintien = Date.now();
            ecrire(": maintien\n\n");
            await controlerPresence();
          }
          echecs = 0;
        } catch (e) {
          // Base momentanément injoignable : on insiste un peu, puis on rend la main (le client se reconnectera).
          if (++echecs >= 5) { console.error("[pos/flux]", e); break; }
        }
        if (!plein) await pause(PAS_MS, req.signal);
      }
      try { controleur.close(); } catch { /* déjà fermé par le client */ }
    };

    const flux = new ReadableStream<Uint8Array>({
      start(controleur) { void boucle(controleur); },
      cancel() { ferme = true; },
    });
    return new Response(flux, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    return reponseErreurPos(e);
  }
}
