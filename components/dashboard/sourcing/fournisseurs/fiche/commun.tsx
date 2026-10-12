"use client";
// Briques communes aux onglets de la fiche fournisseur : type de la fiche,
// écriture avec message d'erreur, dates, notes 1–5, envoi de fichier, message à
// copier / envoyer au fournisseur.
import { useState } from "react";
import { Check, Copy, ExternalLink, Mail, MessageCircle, Trash2 } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { televerser } from "@/lib/televerser";
import { Bouton, Champ, CLASSE_CHAMP } from "@/components/dashboard/sourcing/ui";
import type { Candidat } from "@/lib/sourcing/fournisseurs/classement";
import type { AnalyseFournisseur, Dossier } from "@/lib/sourcing/fournisseurs/types";

/** Réponse de GET /api/fournisseurs/[id]. Les dates arrivent en chaînes ISO (JSON). */
export interface Fiche {
  dossier: Dossier;
  analyse: AnalyseFournisseur;
  offres: Candidat[];
  contexte: { pays: string; paysNom: string; devise: string; quantite: number };
  produits: { id: string; nom: string }[];
  servicesTiers: { id: string; nom: string; statut: "actif" | "sandbox" | "a_connecter"; libelleStatut: string; description: string; urlSite: string | null }[];
}

export interface PropsOnglet { fiche: Fiche; recharger: () => Promise<void> }

type DateJson = Date | string | null | undefined;
export const dateCourte = (v: DateJson, loc?: string) => (v ? new Date(v).toLocaleDateString(loc) : "—");
/** Valeur d'un `<input type="date">`. */
export const dateChamp = (v: DateJson) => (v ? new Date(v).toISOString().slice(0, 10) : "");
/** Jours entiers d'ici à la date (négatif si elle est passée). */
export const joursAvant = (v: Date | string) => Math.ceil((new Date(v).getTime() - Date.now()) / 86_400_000);

/** Écriture suivie d'un rechargement de la fiche ; l'erreur de l'API est gardée pour affichage. */
export function useEcriture(recharger: () => Promise<void>) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const executer = async (action: () => Promise<unknown>) => {
    setEnCours(true); setErreur(null);
    try { await action(); await recharger(); return true; }
    catch (e) { setErreur((e as Error).message); return false; }
    finally { setEnCours(false); }
  };
  return { erreur, enCours, executer };
}

/** Note de 1 à 5. */
export function Note({ valeur, onChange }: { valeur: number | undefined; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} aria-pressed={valeur === n}
          className="w-8 h-8 rounded-lg text-[12px] font-bold border transition-all"
          style={valeur === n ? { background: "#F5A623", borderColor: "#F5A623", color: "#111111" } : { background: "#FFFFFF", borderColor: "#E8E8E8", color: "#666666" }}>{n}</button>
      ))}
    </div>
  );
}

export function BoutonSupprimer({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const t = useT();
  return (
    <button type="button" disabled={disabled} title={t("Supprimer")} aria-label={t("Supprimer")}
      onClick={() => { if (window.confirm(t("Supprimer définitivement cet élément ?"))) onClick(); }}
      className="p-1.5 rounded-lg text-[#AAAAAA] hover:text-[#B91C1C] hover:bg-[#FEF2F2] disabled:opacity-50 shrink-0"><Trash2 size={14} /></button>
  );
}

export function LienFichier({ url, libelle = "Voir le fichier" }: { url: string; libelle?: string }) {
  const t = useT();
  return <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#B45309] hover:underline"><ExternalLink size={11} />{t(libelle)}</a>;
}

/** Envoi d'un fichier (certificat, rapport) ; renvoie son URL. */
export function ChampFichier({ label, url, onChange }: { label: string; url: string; onChange: (url: string) => void }) {
  const t = useT();
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const choisir = async (fichier: File | undefined) => {
    if (!fichier) return;
    setEnvoi(true); setErreur(null);
    const fd = new FormData();
    fd.append("file", fichier);
    try {
      const d = await (await televerser(fd, "document")).json();
      if (d.error) setErreur(d.error); else onChange(d.url);
    } catch (e) { setErreur((e as Error).message); }
    finally { setEnvoi(false); }
  };
  return (
    <Champ label={label} aide="PDF ou image, 20 Mo au plus.">
      <input type="file" accept="application/pdf,image/*" disabled={envoi} onChange={(e) => choisir(e.target.files?.[0])} className={CLASSE_CHAMP} />
      {envoi && <span className="block text-[11px] text-[#666666] mt-1">{t("Envoi en cours…")}</span>}
      {url && !envoi && <span className="block mt-1"><LienFichier url={url} libelle="Fichier envoyé" /></span>}
      {erreur && <span className="block text-[11px] text-[#B91C1C] mt-1">{t(erreur)}</span>}
    </Champ>
  );
}

/** Message modifiable à envoyer soi-même au fournisseur : copier, WhatsApp, e-mail. */
export function MessageAEnvoyer({ message, onChange, telephone, email, sujet }: { message: string; onChange: (m: string) => void; telephone?: string | null; email?: string | null; sujet: string }) {
  const t = useT();
  const [copie, setCopie] = useState(false);
  const chiffres = (telephone ?? "").replace(/\D/g, "");
  const classeLien = "inline-flex items-center gap-1.5 rounded-xl font-bold px-3 py-1.5 text-[11px] bg-white text-[#111111] border border-[#E8E8E8] hover:border-[#F5A623]";
  return (
    <div className="space-y-2">
      <textarea value={message} onChange={(e) => onChange(e.target.value)} rows={10} className={`${CLASSE_CHAMP} leading-relaxed`} />
      <div className="flex gap-2 flex-wrap">
        <Bouton petit variante="secondaire" onClick={async () => { await navigator.clipboard.writeText(message); setCopie(true); setTimeout(() => setCopie(false), 2000); }}>
          {copie ? <Check size={12} /> : <Copy size={12} />}{t(copie ? "Copié" : "Copier")}
        </Bouton>
        {chiffres.length >= 8 && <a className={classeLien} target="_blank" rel="noopener noreferrer" href={`https://wa.me/${chiffres}?text=${encodeURIComponent(message)}`}><MessageCircle size={12} />WhatsApp</a>}
        {email && <a className={classeLien} href={`mailto:${email}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(message)}`}><Mail size={12} />{t("E-mail")}</a>}
      </div>
    </div>
  );
}
