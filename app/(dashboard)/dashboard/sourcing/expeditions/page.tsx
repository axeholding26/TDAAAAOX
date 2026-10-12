"use client";
// Expéditions internationales (fournisseur → pays → entrepôt local). Le suivi est
// SAISI par le marchand : aucun transporteur n'est interrogé.
import { useState } from "react";
import { ChevronDown, Info, PackageCheck, Pencil, Plus, Truck } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { LIBELLES_EXPEDITION, STATUTS_EXPEDITION, transitionExpeditionValide, type StatutExpedition } from "@/lib/sourcing/statuts";
import { Bouton, Carte, Champ, ChampNombre, Chargement, CLASSE_CHAMP, Entete, Erreur, EtatVide, Onglets, Page, Pastille, envoyer, useApi } from "@/components/dashboard/sourcing/ui";

interface Entrepot { id: string; nom: string; ville: string | null }
interface Expedition {
  id: string; commandeFournisseurId: string | null; commandeId: string | null; produitSourceId: string | null; quantite: number | null;
  mode: string | null; transporteur: string | null; transitaire: string | null; trackingNo: string | null; statut: StatutExpedition;
  paysOrigine: string | null; paysDestination: string | null; pointEntree: string | null; entrepotId: string | null;
  poidsKg: number | null; cout: number | null; dateExpedition: string | null; arriveeEstimee: string | null; arriveeReelle: string | null;
  stockRecu: boolean; evenements: { statut: string; date: string; note?: string }[] | null; notes: string | null;
  commande: { numero: string; clientNom: string } | null; produit: { id: string; nom: string; produitId: string | null } | null; entrepot: Entrepot | null;
}
interface ProduitSource { id: string; nom: string; modeAppro: string; produitId: string | null }

const MODES = [
  { cle: "aerien", libelle: "Aérien" }, { cle: "maritime", libelle: "Maritime" },
  { cle: "express", libelle: "Express" }, { cle: "routier", libelle: "Routier" },
];
const libelleMode = (m: string | null) => MODES.find((x) => x.cle === m)?.libelle ?? null;
// Midi UTC : la date choisie reste le même jour quel que soit le fuseau.
const versIso = (jour: string) => (jour ? `${jour}T12:00:00.000Z` : undefined);
const texte = (s: string) => s.trim() || undefined;

type Filtre = "toutes" | StatutExpedition;

export default function PageExpeditions() {
  const t = useT();
  const { data, erreur, chargement, recharger } = useApi<{ expeditions: Expedition[]; entrepots: Entrepot[] }>("/api/sourcing/expeditions");
  const [filtre, setFiltre] = useState<Filtre>("toutes");
  const [nouveau, setNouveau] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const expeditions = data?.expeditions ?? [];
  const visibles = filtre === "toutes" ? expeditions : expeditions.filter((e) => e.statut === filtre);
  const fait = (message: string | null) => { setInfo(message); setNouveau(false); recharger(); };

  return (
    <Page>
      <Entete badge="AXSO Sourcing" titre="Expéditions internationales"
        sousTitre="Suivez chaque colis du fournisseur jusqu'à votre entrepôt local."
        actions={<Bouton onClick={() => setNouveau((v) => !v)}><Plus size={14} />{t("Nouveau réapprovisionnement")}</Bouton>} />

      <div className="flex items-start gap-2 rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] p-3.5 text-[12px] text-[#1D4ED8] leading-relaxed">
        <Info size={14} className="mt-0.5 flex-shrink-0" />
        {t("Le suivi est saisi par vous à partir des informations de votre fournisseur ou transitaire. Aucun transporteur n'est encore connecté.")}
      </div>

      {info && (
        <div className="flex items-start gap-2 rounded-2xl border border-[#BBF7D0] bg-[#ECFDF5] p-3.5 text-[13px] text-[#15803D]">
          <PackageCheck size={15} className="mt-0.5 flex-shrink-0" />{info}
        </div>
      )}

      {nouveau && <FormulaireReappro entrepots={data?.entrepots ?? []} onCree={() => fait(t("Réapprovisionnement créé."))} onFermer={() => setNouveau(false)} />}

      {erreur && <Erreur message={erreur} />}
      {chargement && !data && <Chargement />}

      {data && expeditions.length === 0 && !nouveau && (
        <EtatVide titre="Aucune expédition pour le moment"
          texte="Une expédition se crée quand un fournisseur expédie une commande, ou quand vous importez du stock avec « Nouveau réapprovisionnement »." >
          <Bouton href="/dashboard/sourcing/commandes" variante="secondaire">{t("Voir les commandes fournisseurs")}</Bouton>
        </EtatVide>
      )}

      {expeditions.length > 0 && (
        <>
          <Onglets<Filtre> actif={filtre} onChange={setFiltre} onglets={[
            { cle: "toutes", libelle: "Toutes", nombre: expeditions.length },
            ...([...STATUTS_EXPEDITION, "annulee"] as StatutExpedition[]).map((s) => ({ cle: s as Filtre, libelle: LIBELLES_EXPEDITION[s], nombre: expeditions.filter((e) => e.statut === s).length })),
          ]} />
          {visibles.length === 0 && <p className="text-[13px] text-[#666666] text-center py-6">{t("Aucune expédition à ce statut.")}</p>}
          <div className="grid gap-3 lg:grid-cols-2">
            {visibles.map((e) => <CarteExpedition key={e.id} e={e} entrepots={data?.entrepots ?? []} onFait={fait} />)}
          </div>
        </>
      )}
    </Page>
  );
}

function CarteExpedition({ e, entrepots, onFait }: { e: Expedition; entrepots: Entrepot[]; onFait: (message: string | null) => void }) {
  const t = useT();
  const { fmt } = useDevise();
  const [ouvert, setOuvert] = useState(false);
  const [edition, setEdition] = useState(false);
  const [note, setNote] = useState("");
  const [suivi, setSuivi] = useState({ trackingNo: e.trackingNo ?? "", transporteur: e.transporteur ?? "", arriveeEstimee: e.arriveeEstimee?.slice(0, 10) ?? "", entrepotId: e.entrepotId ?? "" });
  const [charge, setCharge] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const jour = (d: string | null) => (d ? new Date(d).toLocaleDateString(t.loc) : "—");
  const index = STATUTS_EXPEDITION.indexOf(e.statut as (typeof STATUTS_EXPEDITION)[number]);
  const annulee = e.statut === "annulee";
  const suivant = index >= 0 ? STATUTS_EXPEDITION[index + 1] : undefined;
  const reappro = !!e.produitSourceId && !!e.quantite;
  // L'arrivée à l'entrepôt d'un réapprovisionnement déclenche l'entrée en stock côté serveur.
  const entreeEnStock = suivant === "entrepot_local" && reappro;

  async function patch(corps: Record<string, unknown>, message: (r: { stockEntre: number; aRepartir?: boolean }) => string | null) {
    setCharge(true); setErreur(null);
    try {
      const r = await envoyer<{ ok: boolean; stockEntre: number; aRepartir?: boolean }>("/api/sourcing/expeditions", "PATCH", { id: e.id, ...corps });
      setEdition(false); setNote("");
      onFait(message(r));
    } catch (err) {
      setErreur((err as Error).message);
    } finally {
      setCharge(false);
    }
  }

  const avancer = () => suivant && patch({ statut: suivant, note: texte(note) }, (r) =>
    suivant !== "entrepot_local" || !reappro ? null
      : r.stockEntre > 0 ? t("{0} unités de « {1} » sont entrées en stock.", r.stockEntre, e.produit?.nom ?? "") + (r.aRepartir ? " " + t("Ce produit a des variantes : répartissez ces unités entre elles dans la fiche produit, sinon elles ne sont pas vendables.") : "")
      : t("Expédition arrivée, mais aucune entrée en stock automatique : le produit n'est pas publié en boutique avec un stock suivi. Ajustez le stock à la main."));

  const details: [string, string | null][] = [
    ["Mode", libelleMode(e.mode) && t(libelleMode(e.mode)!)],
    ["Transporteur", e.transporteur],
    ["Transitaire", e.transitaire],
    ["Numéro de suivi", e.trackingNo],
    ["Trajet", [e.paysOrigine, e.paysDestination].filter(Boolean).join(" → ") || null],
    ["Point d'entrée", e.pointEntree],
    ["Entrepôt de destination", e.entrepot ? `${e.entrepot.nom}${e.entrepot.ville ? ` (${e.entrepot.ville})` : ""}` : null],
    ["Expédiée le", e.dateExpedition && jour(e.dateExpedition)],
    ["Arrivée estimée", e.arriveeEstimee && jour(e.arriveeEstimee)],
    ["Arrivée réelle", e.arriveeReelle && jour(e.arriveeReelle)],
    ["Poids", e.poidsKg !== null ? `${e.poidsKg} kg` : null],
    ["Coût du transport", e.cout !== null ? fmt(e.cout) : null],
  ];

  return (
    <Carte>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[14px] font-bold text-[#111111] leading-snug flex items-center gap-1.5">
            <Truck size={14} className="text-[#B45309] flex-shrink-0" />
            {e.commande ? t("Commande #{0}", e.commande.numero)
              : e.produit ? t("Réapprovisionnement : {0} × {1}", e.produit.nom, e.quantite ?? "—")
              : t("Expédition")}
          </p>
          {e.commande && <p className="text-[12px] text-[#666666] mt-0.5">{e.commande.clientNom}</p>}
        </div>
        <Pastille ton={annulee ? "attention" : e.statut === "entrepot_local" ? "positif" : "accent"}>{t(LIBELLES_EXPEDITION[e.statut] ?? e.statut)}</Pastille>
      </div>

      {!annulee && (
        <div className="mt-3">
          <div className="flex gap-1">
            {STATUTS_EXPEDITION.map((s, i) => <span key={s} className="h-1.5 flex-1 rounded-full" style={{ background: i <= index ? "#F5A623" : "#F0F0F0" }} />)}
          </div>
          <p className="text-[11px] text-[#AAAAAA] mt-1">{t("Étape {0}/{1}", index + 1, STATUTS_EXPEDITION.length)}</p>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3 text-[12px]">
        {details.filter(([, v]) => v).map(([l, v]) => (
          <div key={l} className="min-w-0">
            <dt className="text-[#AAAAAA]">{t(l)}</dt>
            <dd className="text-[#111111] font-semibold break-words">{v}</dd>
          </div>
        ))}
      </dl>
      {!e.trackingNo && !annulee && <p className="text-[11px] text-[#AAAAAA] mt-2">{t("Numéro de suivi non renseigné.")}</p>}
      {e.notes && <p className="text-[12px] text-[#666666] mt-2">{e.notes}</p>}
      {e.stockRecu && <p className="flex items-center gap-1.5 text-[12px] text-[#15803D] font-semibold mt-2"><PackageCheck size={13} />{t("{0} unités entrées en stock", e.quantite ?? 0)}</p>}

      <button onClick={() => setOuvert((v) => !v)} className="flex items-center gap-1 text-[12px] font-semibold text-[#B45309] mt-3">
        {t("Étapes et historique")}<ChevronDown size={13} className={ouvert ? "rotate-180" : ""} />
      </button>
      {ouvert && (
        <ol className="mt-2 space-y-1.5">
          {STATUTS_EXPEDITION.map((s, i) => {
            const ev = (e.evenements ?? []).find((x) => x.statut === s);
            const passe = !annulee && i <= index;
            return (
              <li key={s} className="flex items-start gap-2 text-[12px]">
                <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: ev || passe ? "#F5A623" : "#E8E8E8" }} />
                <span className={i === index && !annulee ? "font-bold text-[#111111]" : ev || passe ? "text-[#111111]" : "text-[#AAAAAA]"}>
                  {t(LIBELLES_EXPEDITION[s])}
                  {ev && <span className="text-[#AAAAAA] font-normal"> · {jour(ev.date)}</span>}
                  {ev?.note && <span className="block text-[#666666] font-normal">{ev.note}</span>}
                </span>
              </li>
            );
          })}
          {(e.evenements ?? []).filter((x) => x.statut === "annulee").map((ev) => (
            <li key={ev.date} className="flex items-start gap-2 text-[12px] text-[#B91C1C] font-bold">
              <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 bg-[#B91C1C]" />
              <span>{t("Annulée")}<span className="text-[#AAAAAA] font-normal"> · {jour(ev.date)}</span>{ev.note && <span className="block text-[#666666] font-normal">{ev.note}</span>}</span>
            </li>
          ))}
        </ol>
      )}

      {erreur && <div className="mt-3"><Erreur message={erreur} /></div>}

      {suivant && (
        <div className="mt-4 pt-3 border-t border-[#F5F5F5] space-y-2">
          {entreeEnStock && (
            <p className="text-[12px] text-[#B45309] bg-[#FFF7ED] border border-[#FDE68A] rounded-xl p-2.5 leading-relaxed">
              {t("À cette étape, {0} unités seront ajoutées automatiquement au stock du produit, s'il est publié en boutique avec un stock suivi.", e.quantite ?? 0)}
            </p>
          )}
          <input value={note} onChange={(ev) => setNote(ev.target.value)} maxLength={500} placeholder={t("Note (facultatif)")} className={CLASSE_CHAMP} />
          <div className="flex gap-2 flex-wrap">
            <Bouton onClick={avancer} charge={charge} petit>{t("Étape suivante : {0}", t(LIBELLES_EXPEDITION[suivant]))}</Bouton>
            <Bouton onClick={() => setEdition((v) => !v)} variante="secondaire" petit><Pencil size={11} />{t("Modifier le suivi")}</Bouton>
            {transitionExpeditionValide(e.statut, "annulee") && (
              <Bouton variante="discret" petit disabled={charge}
                onClick={() => { if (window.confirm(t("Annuler cette expédition ?"))) patch({ statut: "annulee", note: texte(note) }, () => null); }}>
                {t("Annuler")}
              </Bouton>
            )}
          </div>
        </div>
      )}

      {edition && suivant && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Champ label="Numéro de suivi"><input value={suivi.trackingNo} maxLength={120} onChange={(ev) => setSuivi({ ...suivi, trackingNo: ev.target.value })} className={CLASSE_CHAMP} /></Champ>
          <Champ label="Transporteur"><input value={suivi.transporteur} maxLength={120} onChange={(ev) => setSuivi({ ...suivi, transporteur: ev.target.value })} className={CLASSE_CHAMP} /></Champ>
          <Champ label="Arrivée estimée"><input type="date" value={suivi.arriveeEstimee} onChange={(ev) => setSuivi({ ...suivi, arriveeEstimee: ev.target.value })} className={CLASSE_CHAMP} /></Champ>
          <Champ label="Entrepôt de destination">
            <select value={suivi.entrepotId} onChange={(ev) => setSuivi({ ...suivi, entrepotId: ev.target.value })} className={CLASSE_CHAMP}>
              <option value="">{t("Aucun")}</option>
              {entrepots.map((x) => <option key={x.id} value={x.id}>{x.nom}{x.ville ? ` (${x.ville})` : ""}</option>)}
            </select>
          </Champ>
          <div className="sm:col-span-2">
            <Bouton petit charge={charge} onClick={() => patch({
              trackingNo: texte(suivi.trackingNo), transporteur: texte(suivi.transporteur),
              arriveeEstimee: versIso(suivi.arriveeEstimee), entrepotId: suivi.entrepotId || null,
            }, () => null)}>{t("Enregistrer le suivi")}</Bouton>
          </div>
        </div>
      )}
    </Carte>
  );
}

function FormulaireReappro({ entrepots, onCree, onFermer }: { entrepots: Entrepot[]; onCree: () => void; onFermer: () => void }) {
  const t = useT();
  const { devise } = useDevise();
  const { data, chargement } = useApi<{ produits: ProduitSource[] }>("/api/sourcing/produits");
  const [f, setF] = useState({ produitSourceId: "", mode: "maritime", transitaire: "", entrepotId: "", arriveeEstimee: "" });
  const [quantite, setQuantite] = useState<number | undefined>();
  const [cout, setCout] = useState<number | undefined>();
  const [charge, setCharge] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const produits = data?.produits ?? [];
  const choisi = produits.find((p) => p.id === f.produitSourceId);

  async function creer() {
    if (!f.produitSourceId || !quantite) { setErreur(t("Choisissez un produit et une quantité.")); return; }
    setCharge(true); setErreur(null);
    try {
      await envoyer("/api/sourcing/expeditions", "POST", {
        produitSourceId: f.produitSourceId, quantite: Math.round(quantite), mode: f.mode, transitaire: texte(f.transitaire),
        cout, entrepotId: f.entrepotId || undefined, arriveeEstimee: versIso(f.arriveeEstimee),
      });
      onCree();
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setCharge(false);
    }
  }

  return (
    <Carte titre="Nouveau réapprovisionnement" aide="Import de stock : vous achetez en quantité chez le fournisseur et le stock arrive dans votre entrepôt local.">
      {chargement && !data ? <Chargement /> : produits.length === 0 ? (
        <EtatVide titre="Aucun produit sourcé" texte="Ajoutez d'abord un produit à votre catalogue sourcing pour pouvoir le réapprovisionner.">
          <Bouton href="/dashboard/sourcing/catalogue">{t("Ouvrir le catalogue")}</Bouton>
        </EtatVide>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Champ label="Produit">
              <select value={f.produitSourceId} onChange={(e) => setF({ ...f, produitSourceId: e.target.value })} className={CLASSE_CHAMP}>
                <option value="">{t("Choisir un produit")}</option>
                {produits.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
              </select>
            </Champ>
          </div>
          <ChampNombre label="Quantité" valeur={quantite} onChange={setQuantite} pas={1} suffixe={t("unités")} />
          <Champ label="Mode de transport">
            <select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })} className={CLASSE_CHAMP}>
              {MODES.map((m) => <option key={m.cle} value={m.cle}>{t(m.libelle)}</option>)}
            </select>
          </Champ>
          <Champ label="Transitaire"><input value={f.transitaire} maxLength={120} onChange={(e) => setF({ ...f, transitaire: e.target.value })} className={CLASSE_CHAMP} /></Champ>
          <ChampNombre label="Coût du transport" valeur={cout} onChange={setCout} suffixe={devise} />
          <Champ label="Entrepôt de destination" aide={entrepots.length === 0 ? "Aucun entrepôt enregistré : le stock entrera dans le stock général de la boutique." : undefined}>
            <select value={f.entrepotId} onChange={(e) => setF({ ...f, entrepotId: e.target.value })} className={CLASSE_CHAMP}>
              <option value="">{t("Aucun")}</option>
              {entrepots.map((x) => <option key={x.id} value={x.id}>{x.nom}{x.ville ? ` (${x.ville})` : ""}</option>)}
            </select>
          </Champ>
          <Champ label="Arrivée estimée"><input type="date" value={f.arriveeEstimee} onChange={(e) => setF({ ...f, arriveeEstimee: e.target.value })} className={CLASSE_CHAMP} /></Champ>

          <p className="sm:col-span-2 text-[12px] text-[#666666] leading-relaxed">
            {t("À l'arrivée à l'entrepôt local, le stock du produit sera augmenté automatiquement si le produit est publié en boutique avec un mode « stock ».")}
          </p>
          {choisi && (!choisi.produitId || choisi.modeAppro === "dropshipping") && (
            <p className="sm:col-span-2 text-[12px] text-[#B45309] bg-[#FFF7ED] border border-[#FDE68A] rounded-xl p-2.5 leading-relaxed">
              {!choisi.produitId
                ? t("Ce produit n'est pas encore publié en boutique : aucune entrée en stock automatique n'aura lieu à l'arrivée.")
                : t("Ce produit est en mode dropshipping : aucune entrée en stock automatique n'aura lieu tant qu'il n'est pas passé en mode « stock ».")}
            </p>
          )}
          {erreur && <div className="sm:col-span-2"><Erreur message={erreur} /></div>}
          <div className="sm:col-span-2 flex gap-2">
            <Bouton onClick={creer} charge={charge}>{t("Créer le réapprovisionnement")}</Bouton>
            <Bouton onClick={onFermer} variante="secondaire">{t("Fermer")}</Bouton>
          </div>
        </div>
      )}
    </Carte>
  );
}
