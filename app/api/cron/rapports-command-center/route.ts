// Envoi des rapports planifiés du Command Center (réglages « rapports »).
// Quotidien : chaque jour ; hebdomadaire : le lundi ; mensuel : le 1er (UTC).
// Données RÉELLES uniquement ; chaque envoi est journalisé (AuditAdmin).
// Protégée par CRON_SECRET comme les autres tâches planifiées.
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { hasResend } from "@/lib/email";
import { chargerDataset, lireReglages, analyser, journaliser, type ContexteCC } from "@/lib/command-center/serveur";
import { Vue } from "@/lib/command-center/moteur";
import { fenetres, lireFiltres } from "@/lib/command-center/contexte";
import { construireRapport, fenetreFrequence, rapportEnHtml, estDu } from "@/lib/command-center/rapports";

export const maxDuration = 60;

function autorise(req: Request) {
  const secret = process.env.CRON_SECRET;
  return !!secret && (req.headers.get("x-cron-secret") === secret || req.headers.get("authorization") === `Bearer ${secret}`);
}

// Pseudo-session pour le journal d'audit : l'auteur de l'envoi est la tâche planifiée.
const CRON = { userId: "cron", email: "cron@axso", role: "admin" as const };

export async function GET(req: Request) {
  if (!autorise(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const reglages = await lireReglages();
  const aEnvoyer = reglages.rapports.filter((r) => r.actif && r.destinataires.length && estDu(r.frequence, Date.now()));
  if (!aEnvoyer.length) return NextResponse.json({ envoyes: 0, message: "Aucun rapport à envoyer aujourd'hui" });
  if (!hasResend()) return NextResponse.json({ error: "RESEND_API_KEY absente : aucun rapport envoyé" }, { status: 503 });

  const { ds } = await chargerDataset("reel");
  const filtres = lireFiltres({});
  const vue = new Vue(ds, filtres);
  vue.etapeActivation = reglages.activation;
  const fen = fenetres(filtres, ds.genereA);
  // Risques, seuils et priorités : même calcul que le Command Center sur sa période par défaut (30 jours).
  // analyser() ne lit que vue, fen et reglages.
  const a = analyser({ vue, fen, reglages, ds, filtres } as ContexteCC);
  const resend = new Resend(process.env.RESEND_API_KEY);
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://axsoafrica.com";

  const bilan: { type: string; destinataires: number; envoye: boolean }[] = [];
  for (const r of aEnvoyer) {
    const rp = construireRapport(r.type, vue, fenetreFrequence(r.frequence, vue.maintenant), a, reglages);
    const { error } = await resend.emails.send({
      from: "Axso Command Center <noreply@axsoafrica.com>",
      to: r.destinataires,
      subject: `${rp.titre} — ${rp.periode}`,
      html: rapportEnHtml(rp, base),
    });
    if (error) console.error("[cron/rapports-command-center] envoi refusé par Resend :", error.message);
    bilan.push({ type: r.type, destinataires: r.destinataires.length, envoye: !error });
    await journaliser(CRON, error ? "rapport.echec_envoi" : "rapport.envoi", "RapportPlanifie", r.type, undefined, { frequence: r.frequence, destinataires: r.destinataires, periode: rp.periode, erreur: error?.message });
  }
  console.log("[cron/rapports-command-center]", bilan);
  return NextResponse.json({ envoyes: bilan.filter((b) => b.envoye).length, bilan });
}
