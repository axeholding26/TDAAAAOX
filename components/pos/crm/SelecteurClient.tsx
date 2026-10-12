"use client";
// Sélecteur de client de la caisse : recherche (téléphone, nom, code client, QR
// de la carte client) et création rapide (nom + téléphone).
//
// PROPS
//   valeur      Client associé à la vente, ou null (« Client comptoir »).
//   onChoisir   Appelé avec le client choisi ou créé, ou null quand on le retire.
//   caisseId    Caisse de travail (envoyée dans l'en-tête x-pos-caisse). Facultatif.
//   creation    Propose « Nouveau client » (défaut true). Le serveur exige le droit vendre ou gerer_clients.
//   autoFocus   Place le curseur dans la recherche à l'affichage.
//   refSaisie   Ref du champ de recherche (pour le raccourci F3 de l'écran de caisse).
//   className
//
// Le client rendu est un `ClientCaisse` (id, nom, telephone, codeClient, segment,
// niveau, points, credit { plafond, utilise, disponible, bloque }…) : le même
// objet que GET /api/pos/clients. Pour la fiche complète : <FicheClientCaisse />.
//
// Un code scanné (QR « AXSO-CLIENT:… » ou code client) qui désigne un seul client
// le sélectionne directement. Clavier : ↑ ↓ pour parcourir, Entrée pour choisir.
import { useEffect, useId, useRef, useState } from "react";
import { Search, UserPlus, X } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { Badge, Bouton, BoutonIcone, CLASSE_SAISIE, EtatChargement, EtatPos, FOCUS, Saisie } from "@/components/pos/ui";
import { cn } from "@/lib/utils";
import type { ResumeClient } from "@/app/api/pos/clients/_clients";
import { appelPos, nouvelleCle } from "./appel";
import { LIBELLES_NIVEAU, LIBELLES_SEGMENT, TON_NIVEAU, TON_SEGMENT } from "./libelles";

export type ClientCaisse = ResumeClient;

export type SelecteurClientProps = {
  valeur: ClientCaisse | null;
  onChoisir: (client: ClientCaisse | null) => void;
  caisseId?: string | null;
  creation?: boolean;
  autoFocus?: boolean;
  refSaisie?: React.Ref<HTMLInputElement>;
  className?: string;
};

export function SelecteurClient({ valeur, onChoisir, caisseId, creation = true, autoFocus, refSaisie, className }: SelecteurClientProps) {
  const t = useT();
  const { fmt } = useDevise();
  const idListe = useId();
  const [q, setQ] = useState("");
  const [resultats, setResultats] = useState<ClientCaisse[] | null>(null);
  const [charge, setCharge] = useState(false);
  const [erreur, setErreur] = useState<{ code: string; message: string } | null>(null);
  const [actif, setActif] = useState(0);
  const [essai, setEssai] = useState(0);
  const [nouveau, setNouveau] = useState<{ nom: string; telephone: string } | null>(null);
  const [creationEnCours, setCreationEnCours] = useState(false);
  const [erreurCreation, setErreurCreation] = useState<{ message: string; existant?: ClientCaisse } | null>(null);
  const cle = useRef("");

  // Recherche à la frappe (250 ms), la dernière demande annule la précédente.
  useEffect(() => {
    const terme = q.trim();
    if (terme.length < 2) { setResultats(null); setErreur(null); setCharge(false); return; }
    const abandon = new AbortController();
    setCharge(true);
    const minuterie = setTimeout(async () => {
      const r = await appelPos<{ clients: ClientCaisse[] }>(`/api/pos/clients?q=${encodeURIComponent(terme)}&limite=8`, { caisseId, signal: abandon.signal });
      if (abandon.signal.aborted) return;
      setCharge(false);
      if (!r.ok) { setErreur(r); setResultats(null); return; }
      setErreur(null); setActif(0);
      const exact = r.donnees.clients.filter((c) => c.codeClient && terme.toUpperCase().endsWith(c.codeClient));
      // Carte client scannée : un seul client porte ce code, on le prend sans autre geste.
      if (exact.length === 1) { choisir(exact[0]); return; }
      setResultats(r.donnees.clients);
    }, 250);
    return () => { clearTimeout(minuterie); abandon.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, caisseId, essai]);

  function choisir(c: ClientCaisse | null) {
    setQ(""); setResultats(null); setNouveau(null); setErreurCreation(null);
    onChoisir(c);
  }

  function ouvrirCreation() {
    const terme = q.trim();
    const telephone = /^[+\d][\d\s().-]{5,}$/.test(terme);
    cle.current = nouvelleCle();
    setErreurCreation(null);
    setNouveau({ nom: telephone ? "" : terme, telephone: telephone ? terme : "" });
  }

  async function creer() {
    if (!nouveau) return;
    setCreationEnCours(true); setErreurCreation(null);
    const r = await appelPos<{ client: ClientCaisse }>("/api/pos/clients", { corps: nouveau, cle: cle.current, caisseId });
    setCreationEnCours(false);
    if (r.ok) return choisir(r.donnees.client);
    setErreurCreation({ message: r.message, existant: r.code === "client_existant" ? (r.details?.client as ClientCaisse) : undefined });
  }

  if (valeur) {
    return (
      <div className={cn("flex items-center gap-3 rounded-xl border border-[#E8E8E8] bg-white px-3 py-2", className)}>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold text-[#111111]">{valeur.nom}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-[#666666]">
            <span>{valeur.telephone ?? t("Sans téléphone")}</span>
            <Badge ton={TON_NIVEAU[valeur.niveau] ?? "neutre"}>{t(LIBELLES_NIVEAU[valeur.niveau] ?? valeur.niveau)} · {valeur.points} {t("pts")}</Badge>
            <Badge ton={TON_SEGMENT[valeur.segment]}>{t(LIBELLES_SEGMENT[valeur.segment])}</Badge>
            {valeur.credit.plafond > 0 && <span>{t("Crédit disponible")} : {fmt(valeur.credit.disponible)}</span>}
            {valeur.credit.bloque && <Badge ton="danger">{t("Crédit bloqué")}</Badge>}
          </p>
        </div>
        <BoutonIcone label={t("Retirer le client de la vente")} onClick={() => choisir(null)}><X size={16} aria-hidden /></BoutonIcone>
      </div>
    );
  }

  if (nouveau) {
    return (
      <form className={cn("space-y-3 rounded-xl border border-[#E8E8E8] bg-white p-3", className)} onSubmit={(e) => { e.preventDefault(); creer(); }}>
        <p className="text-[13px] font-bold text-[#111111]">{t("Nouveau client")}</p>
        <Saisie label="Nom" value={nouveau.nom} onChange={(e) => setNouveau({ ...nouveau, nom: e.target.value })} autoFocus={!nouveau.nom} required minLength={2} maxLength={80} autoComplete="off" />
        <Saisie label="Téléphone" type="tel" inputMode="tel" value={nouveau.telephone} onChange={(e) => setNouveau({ ...nouveau, telephone: e.target.value })} autoFocus={!!nouveau.nom} required minLength={6} maxLength={30} autoComplete="off" />
        {erreurCreation && (
          <div role="alert" className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12.5px] text-[#B91C1C]">
            <p>{t(erreurCreation.message)}</p>
            {erreurCreation.existant && <Bouton variante="secondaire" taille="compact" className="mt-2" onClick={() => choisir(erreurCreation.existant!)}>{t("Sélectionner")} {erreurCreation.existant.nom}</Bouton>}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Bouton variante="secondaire" onClick={() => setNouveau(null)}>{t("Annuler")}</Bouton>
          <Bouton type="submit" charge={creationEnCours}>{t("Créer et associer")}</Bouton>
        </div>
      </form>
    );
  }

  const liste = resultats ?? [];
  return (
    <div className={className}>
      <div className="relative">
        <label className="sr-only" htmlFor={idListe + "-q"}>{t("Rechercher un client")}</label>
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#AAAAAA]" aria-hidden />
        <input
          id={idListe + "-q"} ref={refSaisie} value={q} autoFocus={autoFocus} autoComplete="off" inputMode="search"
          role="combobox" aria-expanded={liste.length > 0} aria-controls={idListe} aria-activedescendant={liste[actif] ? `${idListe}-${actif}` : undefined}
          placeholder={t("Téléphone, nom ou carte client")} className={cn(CLASSE_SAISIE, "pl-9")}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActif((i) => Math.min(i + 1, liste.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActif((i) => Math.max(i - 1, 0)); }
            else if (e.key === "Enter" && liste[actif]) { e.preventDefault(); choisir(liste[actif]); }
            else if (e.key === "Escape" && q) { e.stopPropagation(); setQ(""); }
          }}
        />
      </div>

      {charge && !resultats && <EtatChargement compact texte="Recherche du client…" />}
      {erreur && <div className="mt-2"><EtatPos compact code={erreur.code} message={erreur.message} onReessayer={() => setEssai((n) => n + 1)} /></div>}

      {resultats && (
        <ul id={idListe} role="listbox" aria-label={t("Clients trouvés")} className="mt-2 max-h-72 space-y-1 overflow-y-auto">
          {liste.map((c, i) => (
            <li key={c.id} id={`${idListe}-${i}`} role="option" aria-selected={i === actif}>
              <button type="button" onClick={() => choisir(c)} onMouseEnter={() => setActif(i)}
                className={cn("flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors", FOCUS, i === actif ? "border-[#F5A623] bg-[#FFF7ED]" : "border-[#F0F0F0] bg-white")}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold text-[#111111]">{c.nom}</span>
                  <span className="block truncate text-[12px] text-[#666666]">{c.telephone ?? c.email ?? t("Sans téléphone")}{c.codeClient ? ` · ${c.codeClient}` : ""}</span>
                </span>
                <Badge ton={TON_NIVEAU[c.niveau] ?? "neutre"}>{c.points} {t("pts")}</Badge>
                {c.credit.utilise > 0 && <Badge ton={c.credit.bloque ? "danger" : "attention"}>{t("Doit")} {fmt(c.credit.utilise)}</Badge>}
              </button>
            </li>
          ))}
          {!liste.length && <li className="rounded-xl border border-dashed border-[#E8E8E8] px-3 py-3 text-center text-[12.5px] text-[#666666]">{t("Aucun client ne correspond.")}</li>}
        </ul>
      )}

      {creation && q.trim().length >= 2 && !charge && !erreur && (
        <Bouton variante="discret" large className="mt-2" icone={<UserPlus size={15} aria-hidden />} onClick={ouvrirCreation}>{t("Nouveau client")}</Bouton>
      )}
    </div>
  );
}
