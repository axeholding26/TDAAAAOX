"use client";
// Tableau Merchant Intelligence : TableauInteractif + actions groupées (export, assigner, notifier).
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, BellRing, Check, X, Loader2 } from "lucide-react";
import { TableauInteractif, exporterCSV, envoyerAction, type Colonne, type Ligne } from "@/components/command-center/client";
import { useT } from "@/components/I18nProvider";

const EQUIPES = ["Sales", "Growth", "Support", "Produit", "Finance", "Opérations", "CEO"];
const TONS_STATUT = { "En croissance": "good", Sain: "info", "À risque": "warn", Critique: "bad" };

export function TableMarchands({ lignes, revenu, source, peutAgir, lienPage }: { lignes: Ligne[]; revenu: boolean; source: "reel" | "demo"; peutAgir: boolean; lienPage: string }) {
  const t = useT();
  const router = useRouter();
  // Les statuts arrivent traduits (page serveur) : on traduit aussi les clés des tons.
  const tons = Object.fromEntries(Object.entries(TONS_STATUT).map(([k, v]) => [t(k), v]));
  const dlg = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState("");
  const [cibles, setCibles] = useState<string[]>([]);
  const [charge, setCharge] = useState(false);

  const colonnes: Colonne[] = [
    { cle: "nom", nom: t("Marchand"), format: "texte" },
    { cle: "pays", nom: t("Pays"), format: "texte", filtrable: true },
    { cle: "plan", nom: t("Plan"), format: "texte", filtrable: true },
    { cle: "gmv", nom: t("GMV (30 j)"), format: "xaf", droite: true },
    { cle: "commandes", nom: t("Commandes (30 j)"), format: "nombre", droite: true },
    ...(revenu ? [{ cle: "revenu", nom: t("Revenu Axso (30 j)"), format: "xaf", droite: true } as Colonne] : []),
    { cle: "activite", nom: t("Dernière activité"), format: "date" },
    { cle: "ia", nom: t("Usage IA (30 j)"), format: "nombre", droite: true },
    { cle: "score", nom: t("Santé /100"), format: "nombre", droite: true },
    { cle: "statut", nom: t("Statut santé"), format: "badge", filtrable: true, tons },
    { cle: "croissance", nom: t("Croissance cmd."), format: "pct", droite: true },
    { cle: "churn", nom: t("Risque churn"), format: "pct", droite: true },
    { cle: "expansion", nom: t("Score expansion"), format: "nombre", droite: true },
  ];

  const titre = (n: number) => t(n > 1 ? "Suivre {0} marchands (Merchant Intelligence)" : "Suivre {0} marchand (Merchant Intelligence)", n);

  return (
    <>
      <TableauInteractif
        colonnes={colonnes}
        lignes={lignes}
        nomExport="marchands"
        selection
        vide={t("Aucun marchand ne correspond à ces filtres.")}
        actionsGroupees={(ids, vider) => (
          <>
            <button className="cc-btn cc-btn-sm" onClick={() => exporterCSV("marchands-selection", colonnes, lignes.filter((l) => ids.includes(l._id)))}><Download size={12} />{t("Exporter la sélection")}</button>
            {peutAgir && (
              <>
                <select className="cc-select" value="" aria-label={t("Assigner la sélection à une équipe")} onChange={async (e) => { const eq = e.target.value; if (eq && (await envoyerAction({ type: "assigner", titre: titre(ids.length), assigneA: eq, lien: lienPage }))) { vider(); router.refresh(); } }}>
                  <option value="">{t("Assigner à…")}</option>
                  {EQUIPES.map((x) => <option key={x} value={x}>{t(x)}</option>)}
                </select>
                <button className="cc-btn cc-btn-sm" disabled={source !== "reel"} title={t(source !== "reel" ? "Indisponible sur les données de démonstration" : "Envoyer une notification dans le tableau de bord de ces marchands")} onClick={() => { setCibles(ids.slice(0, 500)); setMessage(""); dlg.current?.showModal(); }}><BellRing size={12} />{t("Notifier")}</button>
              </>
            )}
          </>
        )}
      />
      <dialog ref={dlg} className="cc-card p-0 backdrop:bg-black/60 w-[min(480px,92vw)]" style={{ color: "var(--cc-text)" }}>
        <form className="p-4 space-y-3" onSubmit={async (e) => { e.preventDefault(); setCharge(true); const ok = await envoyerAction({ type: "notifier", ids: cibles, titre: "Message de l'équipe Axso", message }); setCharge(false); if (ok) dlg.current?.close(); }}>
          <div className="flex items-center justify-between"><h3 className="cc-h2">{t(cibles.length > 1 ? "Notifier {0} marchands" : "Notifier {0} marchand", cibles.length)}</h3><button type="button" onClick={() => dlg.current?.close()} className="cc-btn cc-btn-ghost cc-btn-sm" aria-label={t("Fermer")}><X size={14} /></button></div>
          <p className="cc-faint text-[12px]">{t("Le message apparaîtra dans les notifications de leur tableau de bord Axso. L'envoi est journalisé.")}</p>
          <textarea className="cc-input w-full h-28 py-2" required minLength={10} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} aria-label={t("Message")} />
          <div className="flex justify-end gap-2"><button type="button" className="cc-btn" onClick={() => dlg.current?.close()}>{t("Annuler")}</button><button className="cc-btn cc-btn-primary" disabled={charge}>{charge ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}{t("Envoyer")}</button></div>
        </form>
      </dialog>
    </>
  );
}
