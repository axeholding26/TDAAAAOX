"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useT } from "@/components/I18nProvider";

const envoyer = (url: string, body: object) =>
  fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => ({ ok: r.ok, d: await r.json().catch(() => ({})) }));

// Correction manuelle d'un devoir : valider ou demander une reprise, avec note et retour.
export function CorrectionDevoir({ produitId, rendu }: { produitId: string; rendu: { id: string; texte: string; apprenant: string; lecon: string; date: string } }) {
  const t = useT();
  const router = useRouter();
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState("");
  const [envoi, setEnvoi] = useState<string | null>(null);
  const [erreur, setErreur] = useState("");
  async function corriger(statut: "valide" | "a_refaire") {
    setEnvoi(statut); setErreur("");
    const { ok, d } = await envoyer(`/api/formations/${produitId}/devoirs/${rendu.id}`, { statut, note: note ? Number(note) : null, feedback });
    setEnvoi(null);
    if (!ok) { setErreur(t(d.error ?? "Erreur")); return; }
    router.refresh();
  }
  return (
    <div className="border border-gray-100 rounded-xl p-4 space-y-2">
      <p className="text-xs text-gray-500"><b className="text-gray-900">{rendu.apprenant}</b> · {rendu.lecon} · {new Date(rendu.date).toLocaleString("fr-FR")}</p>
      <p className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 rounded-lg p-3 max-h-60 overflow-y-auto">{rendu.texte}</p>
      <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2} placeholder={t("Retour pour l'apprenant (facultatif)")} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
      <div className="flex flex-wrap items-center gap-2">
        <input type="number" min={0} max={100} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("Note /100")} className="w-28 px-3 py-1.5 rounded-lg border border-gray-200 text-sm" />
        <button onClick={() => corriger("valide")} disabled={!!envoi} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50">{envoi === "valide" ? <Loader2 size={12} className="animate-spin" /> : t("Valider")}</button>
        <button onClick={() => corriger("a_refaire")} disabled={!!envoi} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold disabled:opacity-50">{envoi === "a_refaire" ? <Loader2 size={12} className="animate-spin" /> : t("À reprendre")}</button>
        {erreur && <span className="text-xs text-red-600">{erreur}</span>}
      </div>
    </div>
  );
}

export function RevocationCertificat({ produitId, certificat: c }: { produitId: string; certificat: { id: string; code: string; nom: string; delivreAt: string; revoqueAt: string | null; revoqueMotif: string | null } }) {
  const t = useT();
  const router = useRouter();
  const [envoi, setEnvoi] = useState(false);
  async function agir(action: "revoquer" | "retablir") {
    let motif: string | null = null;
    if (action === "revoquer") {
      motif = prompt(t("Motif de la révocation (visible dans le journal) :"));
      if (!motif?.trim()) return;
    }
    setEnvoi(true);
    const { ok, d } = await envoyer(`/api/formations/${produitId}/certificats/${c.id}`, action === "revoquer" ? { action, motif } : { action });
    setEnvoi(false);
    if (!ok) { alert(t(d.error ?? "Erreur")); return; }
    router.refresh();
  }
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm border-t border-gray-50 pt-2">
      <span className="font-medium text-gray-900">{c.nom}</span>
      <span className="font-mono text-xs text-gray-500">{c.code}</span>
      <span className="text-xs text-gray-400">{new Date(c.delivreAt).toLocaleDateString("fr-FR")}</span>
      {c.revoqueAt ? (
        <>
          <span className="text-xs text-red-600">{t("Révoquée le")} {new Date(c.revoqueAt).toLocaleDateString("fr-FR")}{c.revoqueMotif ? ` — ${c.revoqueMotif}` : ""}</span>
          <button onClick={() => agir("retablir")} disabled={envoi} className="ml-auto text-xs underline text-gray-600">{t("Rétablir")}</button>
        </>
      ) : (
        <button onClick={() => agir("revoquer")} disabled={envoi} className="ml-auto text-xs text-red-600 underline">{t("Révoquer")}</button>
      )}
    </div>
  );
}
