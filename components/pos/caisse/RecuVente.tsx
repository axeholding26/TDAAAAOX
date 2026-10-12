"use client";
// Fin de vente : le reçu, son impression, et — avec le droit « annuler_vente » —
// l'annulation immédiate d'une vente saisie par erreur (motif obligatoire,
// stock et paiements contre-passés par le serveur, tracé dans l'audit).
// Le panier est déjà vide derrière cette fenêtre : la fermer (ou scanner
// l'article suivant) reprend une nouvelle vente.
import { useRef, useState } from "react";
import { Printer } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { Badge, Bouton, EtatPos, Modale, Saisie } from "@/components/pos/ui";
import { Recu, imprimerRecu, type DonneesRecu } from "@/components/pos/recu/Recu";
import { appelPos } from "./api";

export function RecuVente({ recu, commandeId, rejoue, provisoire = false, caisseId, peutAnnuler, onAnnulee, onFermer }: {
  recu: DonneesRecu;
  commandeId: string;
  /** La vente avait déjà été enregistrée par un envoi précédent : aucun doublon créé. */
  rejoue: boolean;
  /** Vente saisie hors ligne : gardée sur l'appareil, pas encore sur le serveur (numéro provisoire, pas d'annulation possible ici). */
  provisoire?: boolean;
  caisseId: string | null;
  peutAnnuler: boolean;
  onAnnulee: () => void;
  onFermer: () => void;
}) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [annulation, setAnnulation] = useState(false);
  const [motif, setMotif] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<{ code: string; message: string } | null>(null);
  const [impression, setImpression] = useState(true);

  const annuler = async () => {
    if (motif.trim().length < 3) return setErreur({ code: "invalide", message: "Indiquez le motif de l'annulation (au moins 3 caractères)." });
    setEnvoi(true); setErreur(null);
    const r = await appelPos(`/api/pos/ventes/${commandeId}/annuler`, { method: "POST", caisseId, corps: { motif: motif.trim() } });
    setEnvoi(false);
    if (!r.ok) return setErreur({ code: r.code, message: r.message });
    onAnnulee();
  };

  return (
    <Modale ouverte onFermer={onFermer} verrouillee={envoi} titre={provisoire ? "Vente gardée sur cet appareil" : "Vente enregistrée"}
      description={provisoire ? "En attente de synchronisation : cette vente sera envoyée au serveur dès le retour du réseau. Son numéro est provisoire." : rejoue ? "Cette vente a déjà été enregistrée. Aucun doublon n'a été créé." : undefined}
      actions={annulation ? (
        <>
          <Bouton variante="secondaire" onClick={() => { setAnnulation(false); setErreur(null); }} disabled={envoi}>{t("Retour")}</Bouton>
          <Bouton variante="danger" onClick={annuler} charge={envoi}>{t("Confirmer l'annulation")}</Bouton>
        </>
      ) : (
        <>
          {peutAnnuler && !provisoire && <Bouton variante="danger" onClick={() => setAnnulation(true)} className="mr-auto">{t("Annuler cette vente")}</Bouton>}
          <Bouton variante="secondaire" onClick={() => setImpression(imprimerRecu(ref.current, recu.format))} icone={<Printer size={16} aria-hidden />}>{t("Imprimer")}</Bouton>
          <Bouton onClick={onFermer}>{t("Nouvelle vente")}</Bouton>
        </>
      )}>
      {annulation ? (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); annuler(); }}>
          <p className="text-[13px] leading-relaxed text-[#555555]">{t("La vente {0} sera annulée : le stock est remis en rayon et les paiements sont contre-passés. Cette action est tracée.", recu.numero)}</p>
          <Saisie label="Motif de l'annulation" autoFocus value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={300} />
          {erreur && <EtatPos compact code={erreur.code} message={erreur.message} />}
          <button type="submit" hidden />
        </form>
      ) : (
        <div className="space-y-3">
          {provisoire && (
            <p className="flex flex-wrap items-center gap-2 text-[12px] text-[#666666]"><Badge ton="attention">{t("En attente de synchronisation")}</Badge>{t("Reçu provisoire : le numéro définitif sera attribué par le serveur.")}</p>
          )}
          {recu.paiements.some((p) => p.nonVerifie) && (
            <p className="flex flex-wrap items-center gap-2 text-[12px] text-[#666666]"><Badge ton="attention">{t("Non vérifié")}</Badge>{t("Au moins un paiement a été confirmé par le caissier, sans vérification auprès d'un prestataire.")}</p>
          )}
          <div className="overflow-x-auto rounded-xl border border-[#E8E8E8] bg-[#FAFAFA] p-3"><Recu recu={recu} ref={ref} /></div>
          {!impression && <p role="alert" className="text-[12.5px] text-[#B91C1C]">{t("L'impression n'a pas pu être lancée par ce navigateur.")}</p>}
        </div>
      )}
    </Modale>
  );
}
