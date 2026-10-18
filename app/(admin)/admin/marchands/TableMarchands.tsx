"use client";
// Tableau Merchant Intelligence : TableauInteractif + actions groupées (export, assigner, notifier).
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, BellRing, Check, X, Loader2 } from "lucide-react";
import { TableauInteractif, exporterCSV, envoyerAction, type Colonne, type Ligne } from "@/components/command-center/client";

const EQUIPES = ["Sales", "Growth", "Support", "Produit", "Finance", "Opérations", "CEO"];
const TONS_STATUT = { "En croissance": "good", Sain: "info", "À risque": "warn", Critique: "bad" };

export function TableMarchands({ lignes, revenu, source, peutAgir, lienPage }: { lignes: Ligne[]; revenu: boolean; source: "reel" | "demo"; peutAgir: boolean; lienPage: string }) {
  const router = useRouter();
  const dlg = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState("");
  const [cibles, setCibles] = useState<string[]>([]);
  const [charge, setCharge] = useState(false);

  const colonnes: Colonne[] = [
    { cle: "nom", nom: "Marchand", format: "texte" },
    { cle: "pays", nom: "Pays", format: "texte", filtrable: true },
    { cle: "plan", nom: "Plan", format: "texte", filtrable: true },
    { cle: "gmv", nom: "GMV (30 j)", format: "xaf", droite: true },
    { cle: "commandes", nom: "Commandes (30 j)", format: "nombre", droite: true },
    ...(revenu ? [{ cle: "revenu", nom: "Revenu Axso (30 j)", format: "xaf", droite: true } as Colonne] : []),
    { cle: "activite", nom: "Dernière activité", format: "date" },
    { cle: "ia", nom: "Usage IA (30 j)", format: "nombre", droite: true },
    { cle: "score", nom: "Santé /100", format: "nombre", droite: true },
    { cle: "statut", nom: "Statut santé", format: "badge", filtrable: true, tons: TONS_STATUT },
    { cle: "croissance", nom: "Croissance cmd.", format: "pct", droite: true },
    { cle: "churn", nom: "Risque churn", format: "pct", droite: true },
    { cle: "expansion", nom: "Score expansion", format: "nombre", droite: true },
  ];

  const titre = (n: number) => `Suivre ${n} marchand${n > 1 ? "s" : ""} (Merchant Intelligence)`;

  return (
    <>
      <TableauInteractif
        colonnes={colonnes}
        lignes={lignes}
        nomExport="marchands"
        selection
        vide="Aucun marchand ne correspond à ces filtres."
        actionsGroupees={(ids, vider) => (
          <>
            <button className="cc-btn cc-btn-sm" onClick={() => exporterCSV("marchands-selection", colonnes, lignes.filter((l) => ids.includes(l._id)))}><Download size={12} />Exporter la sélection</button>
            {peutAgir && (
              <>
                <select className="cc-select" value="" aria-label="Assigner la sélection à une équipe" onChange={async (e) => { const eq = e.target.value; if (eq && (await envoyerAction({ type: "assigner", titre: titre(ids.length), assigneA: eq, lien: lienPage }))) { vider(); router.refresh(); } }}>
                  <option value="">Assigner à…</option>
                  {EQUIPES.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
                <button className="cc-btn cc-btn-sm" disabled={source !== "reel"} title={source !== "reel" ? "Indisponible sur les données de démonstration" : "Envoyer une notification dans le tableau de bord de ces marchands"} onClick={() => { setCibles(ids.slice(0, 500)); setMessage(""); dlg.current?.showModal(); }}><BellRing size={12} />Notifier</button>
              </>
            )}
          </>
        )}
      />
      <dialog ref={dlg} className="cc-card p-0 backdrop:bg-black/60 w-[min(480px,92vw)]" style={{ color: "var(--cc-text)" }}>
        <form className="p-4 space-y-3" onSubmit={async (e) => { e.preventDefault(); setCharge(true); const ok = await envoyerAction({ type: "notifier", ids: cibles, titre: "Message de l'équipe Axso", message }); setCharge(false); if (ok) dlg.current?.close(); }}>
          <div className="flex items-center justify-between"><h3 className="cc-h2">Notifier {cibles.length} marchand{cibles.length > 1 ? "s" : ""}</h3><button type="button" onClick={() => dlg.current?.close()} className="cc-btn cc-btn-ghost cc-btn-sm" aria-label="Fermer"><X size={14} /></button></div>
          <p className="cc-faint text-[12px]">Le message apparaîtra dans les notifications de leur tableau de bord Axso. L'envoi est journalisé.</p>
          <textarea className="cc-input w-full h-28 py-2" required minLength={10} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} aria-label="Message" />
          <div className="flex justify-end gap-2"><button type="button" className="cc-btn" onClick={() => dlg.current?.close()}>Annuler</button><button className="cc-btn cc-btn-primary" disabled={charge}>{charge ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}Envoyer</button></div>
        </form>
      </dialog>
    </>
  );
}
