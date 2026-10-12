"use client";
// Appareils enregistrés d'une caisse (téléphones-scanners) : état de connexion
// d'après leur dernier signal, renommage, révocation, et le bouton « Connecter
// un scanner ». La liste se met à jour seule (flux temps réel + rafraîchissement
// toutes les 20 s).
//
//   <ListeAppareils caisseId={caisseId} caisseNom="Caisse 1" />
//
// Props :
// - caisseId     : caisse dont on liste les appareils (défaut : la caisse de travail).
// - caisseNom    : nom repris dans la fenêtre d'appairage.
// - portee       : "caisse" (défaut) ou "boutique" (tous les appareils ; droit gerer_appareils ou voir_caisse).
// - sansMateriel : true = masque le bloc « Autres matériels » (douchettes, Bluetooth natif, balances).
// - className
// Renommer, révoquer et connecter exigent le droit gerer_appareils : le serveur
// le vérifie, et les boutons ne s'affichent que si la liste l'annonce (peutGerer).
import { useCallback, useEffect, useState } from "react";
import { Check, Monitor, Pencil, Smartphone, Tablet, Trash2, X } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { Badge, Bouton, BoutonIcone, EtatChargement, EtatPos, EtatVide, Modale, Saisie } from "@/components/pos/ui";
import ModaleAppairage from "./ModaleAppairage";
import { useFluxPos } from "./useFluxPos";

type Appareil = { id: string; nom: string; type: string; caisseId: string | null; dernierSignalAt: string | null; enLigne: boolean };
type Erreur = { code: string; message: string };

async function appeler(url: string, init: RequestInit = {}, caisseId?: string | null): Promise<{ ok: true; corps: any } | ({ ok: false } & Erreur)> {
  try {
    const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(caisseId ? { "x-pos-caisse": caisseId } : {}) } });
    const corps = await r.json().catch(() => ({}));
    return r.ok ? { ok: true, corps } : { ok: false, code: corps.code ?? "erreur_serveur", message: corps.error ?? "L'opération n'a pas abouti. Réessayez." };
  } catch {
    return { ok: false, code: "hors_ligne", message: "Connexion interrompue. Réessayez dès que le réseau revient." };
  }
}

export default function ListeAppareils({ caisseId, caisseNom, portee = "caisse", sansMateriel, className }: {
  caisseId?: string | null; caisseNom?: string; portee?: "caisse" | "boutique"; sansMateriel?: boolean; className?: string;
}) {
  const t = useT();
  const [appareils, setAppareils] = useState<Appareil[] | null>(null);
  const [peutGerer, setPeutGerer] = useState(false);
  const [erreur, setErreur] = useState<Erreur | null>(null);
  const [appairage, setAppairage] = useState(false);
  const [edition, setEdition] = useState<{ id: string; nom: string } | null>(null);
  const [aRevoquer, setARevoquer] = useState<Appareil | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreurAction, setErreurAction] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const r = await appeler(`/api/pos/scanner/appareils${portee === "boutique" ? "?portee=boutique" : ""}`, {}, caisseId);
    if (r.ok) { setAppareils(r.corps.appareils); setPeutGerer(!!r.corps.peutGerer); setErreur(null); }
    // Une liste déjà affichée reste à l'écran pendant une coupure.
    else setErreur(r);
  }, [caisseId, portee]);

  useEffect(() => {
    void charger();
    const i = setInterval(() => void charger(), 20_000);
    return () => clearInterval(i);
  }, [charger]);

  useFluxPos({
    caisseId, portee,
    surEvenement: (e) => {
      if (e.type !== "device.connected" && e.type !== "device.disconnected") return;
      // L'état change tout de suite à l'écran ; la liste complète suit.
      const id = e.payload.appareilId;
      setAppareils((l) => l?.map((a) => (a.id === id ? { ...a, enLigne: e.type === "device.connected" } : a)) ?? l);
      void charger();
    },
  });

  const renommer = async () => {
    if (!edition) return;
    const nom = edition.nom.trim();
    if (!nom) { setErreurAction("Donnez un nom à l'appareil."); return; }
    setEnCours(true);
    const r = await appeler(`/api/pos/scanner/appareils/${edition.id}`, { method: "PATCH", body: JSON.stringify({ nom }) }, caisseId);
    setEnCours(false);
    if (!r.ok) { setErreurAction(r.message); return; }
    setAppareils((l) => l?.map((a) => (a.id === edition.id ? { ...a, nom } : a)) ?? l);
    setEdition(null);
    setErreurAction(null);
  };

  const revoquer = async () => {
    if (!aRevoquer) return;
    setEnCours(true);
    const r = await appeler(`/api/pos/scanner/appareils/${aRevoquer.id}`, { method: "DELETE" }, caisseId);
    setEnCours(false);
    if (!r.ok) { setErreurAction(r.message); return; }
    setAppareils((l) => l?.filter((a) => a.id !== aRevoquer.id) ?? l);
    setARevoquer(null);
    setErreurAction(null);
  };

  const depuis = (iso: string | null) => {
    if (!iso) return t("Aucun signal reçu");
    const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 60) return t("Dernier signal à l'instant");
    if (s < 3600) return t("Dernier signal il y a {0} min", Math.round(s / 60));
    if (s < 86400) return t("Dernier signal il y a {0} h", Math.round(s / 3600));
    return t("Dernier signal le {0}", new Date(iso).toLocaleDateString(t.loc));
  };

  return (
    <section className={className} aria-label={t("Scanners connectés")}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[14px] font-bold text-[#111111]">{t("Scanners connectés")}</h3>
        {peutGerer && portee === "caisse" && <Bouton taille="compact" icone={<Smartphone size={15} aria-hidden />} onClick={() => setAppairage(true)}>{t("Connecter un scanner")}</Bouton>}
      </div>

      {appareils === null && !erreur && <EtatChargement texte="Chargement des appareils…" compact />}
      {appareils === null && erreur && <EtatPos code={erreur.code} message={erreur.message} onReessayer={() => void charger()} compact />}
      {appareils !== null && erreur && <p role="status" className="mb-2 text-[12px] text-[#B45309]">{t("Liste non actualisée :")} {t(erreur.message)}</p>}
      {appareils?.length === 0 && (
        <EtatVide titre="Aucun scanner connecté" texte="Reliez un téléphone à cette caisse : chaque article qu'il scanne arrive directement dans le panier." compact />
      )}

      {!!appareils?.length && (
        <ul className="divide-y divide-[#F0F0F0] rounded-2xl border border-[#E8E8E8] bg-white">
          {appareils.map((a) => {
            const Icone = a.type === "tablette" ? Tablet : a.type === "pc" ? Monitor : Smartphone;
            const enEdition = edition?.id === a.id;
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] text-[#555555]" aria-hidden><Icone size={18} /></span>
                {enEdition ? (
                  <form className="flex min-w-0 flex-1 items-end gap-2" onSubmit={(e) => { e.preventDefault(); void renommer(); }}>
                    <Saisie label="Nom de l'appareil" labelMasque autoFocus maxLength={60} value={edition.nom} onChange={(e) => setEdition({ id: a.id, nom: e.target.value })} erreur={erreurAction} className="min-w-0 flex-1" />
                    <BoutonIcone label={t("Enregistrer le nom")} variante="primaire" disabled={enCours} onClick={() => void renommer()}><Check size={18} aria-hidden /></BoutonIcone>
                    <BoutonIcone label={t("Annuler")} onClick={() => { setEdition(null); setErreurAction(null); }}><X size={18} aria-hidden /></BoutonIcone>
                  </form>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-bold text-[#111111]">{a.nom}</p>
                      <p className="text-[12px] text-[#666666]">{depuis(a.dernierSignalAt)}</p>
                    </div>
                    <Badge ton={a.enLigne ? "positif" : "neutre"} icone={<span className={`h-1.5 w-1.5 rounded-full ${a.enLigne ? "bg-[#15803D]" : "bg-[#AAAAAA]"}`} aria-hidden />}>{t(a.enLigne ? "Connecté" : "Déconnecté")}</Badge>
                    {peutGerer && (
                      <div className="flex gap-1">
                        <BoutonIcone label={t("Renommer {0}", a.nom)} onClick={() => { setErreurAction(null); setEdition({ id: a.id, nom: a.nom }); }}><Pencil size={16} aria-hidden /></BoutonIcone>
                        <BoutonIcone label={t("Révoquer {0}", a.nom)} variante="danger" onClick={() => { setErreurAction(null); setARevoquer(a); }}><Trash2 size={16} aria-hidden /></BoutonIcone>
                      </div>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!sansMateriel && (
        <div className="mt-5">
          <h3 className="mb-2 text-[14px] font-bold text-[#111111]">{t("Autres matériels")}</h3>
          <ul className="divide-y divide-[#F0F0F0] rounded-2xl border border-[#E8E8E8] bg-white text-[12.5px] leading-relaxed text-[#666666]">
            <li className="flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-3">
              <p className="min-w-0 flex-1"><span className="font-bold text-[#111111]">{t("Scanner USB ou Bluetooth en mode clavier")}</span><br />{t("Branchez la douchette (ou jumelez-la au poste en mode clavier) et scannez : le code arrive dans la caisse sans réglage.")}</p>
              <Badge ton="positif">{t("Pris en charge")}</Badge>
            </li>
            <li className="flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-3">
              <p className="min-w-0 flex-1"><span className="font-bold text-[#111111]">{t("Scanner Bluetooth en liaison directe")}</span><br />{t("La liaison Bluetooth directe depuis le navigateur n'existe pas sur iPhone et varie selon les modèles. Réglez la douchette en mode clavier : elle fonctionne alors partout.")}</p>
              <Badge ton="neutre">{t("Intégration en attente")}</Badge>
            </li>
            <li className="flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-3">
              <p className="min-w-0 flex-1"><span className="font-bold text-[#111111]">{t("Balance connectée")}</span><br />{t("La lecture directe du poids n'est pas encore branchée. Saisissez le poids à la main, ou scannez l'étiquette imprimée par la balance : le poids qu'elle contient est lu.")}</p>
              <Badge ton="neutre">{t("Intégration en attente")}</Badge>
            </li>
          </ul>
        </div>
      )}

      <ModaleAppairage ouverte={appairage} onFermer={() => setAppairage(false)} caisseId={caisseId} caisseNom={caisseNom} onConnecte={() => void charger()} />

      <Modale
        ouverte={!!aRevoquer} onFermer={() => { if (!enCours) setARevoquer(null); }} titre="Révoquer ce scanner ?" taille="sm" verrouillee={enCours}
        description={aRevoquer ? t("« {0} » ne pourra plus rien envoyer à la caisse. Pour le réutiliser, il faudra l'appairer de nouveau.", aRevoquer.nom) : undefined}
        actions={
          <>
            <Bouton variante="secondaire" disabled={enCours} onClick={() => setARevoquer(null)}>{t("Annuler")}</Bouton>
            <Bouton variante="danger" charge={enCours} onClick={() => void revoquer()}>{t("Révoquer")}</Bouton>
          </>
        }
      >
        {erreurAction ? <p role="alert" className="text-[12.5px] text-[#B91C1C]">{t(erreurAction)}</p> : <p className="text-[12.5px] text-[#666666]">{t("La révocation prend effet immédiatement et reste inscrite au journal d'audit.")}</p>}
      </Modale>
    </section>
  );
}
