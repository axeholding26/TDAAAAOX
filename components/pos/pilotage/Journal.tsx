"use client";
// Journal d'activité du magasin (§62) : ventes, retours, caisse, stock,
// commandes fournisseur, scanners — dans l'ordre, filtrable, page par page.
// Source : GET /api/pos/journal. Lecture seule ; l'état avant / après d'une
// opération se lit dans le journal d'audit.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { Badge, Bouton, CLASSE_SAISIE, Champ, EtatChargement, EtatPos, EtatVide, FOCUS, Saisie } from "@/components/pos/ui";
import { Carte, EnTete, Page, appelPos, useLecture, type ErreurAppel } from "@/components/pos/finance/commun";
import { dateHeure, type ListesFiltres } from "./commun";

type Entree = { id: string; source: "audit" | "evenement"; action: string; categorie: string; titre: string; detail: string | null; montant: number | null; auteur: string | null; magasinId: string | null; caisseId: string | null; createdAt: string };
type Reponse = { entrees: Entree[]; curseurSuivant: string | null; categories: { id: string; libelle: string }[] };

const TONS_FAMILLE: Record<string, "positif" | "danger" | "accent" | "info" | "neutre" | "attention"> = { ventes: "positif", remboursements: "danger", caisse: "accent", stock: "info", achats: "info", scanners: "neutre", autres: "neutre" };
const VIDE = { categorie: "", magasinId: "", caisseId: "", du: "", au: "" };

export function Journal() {
  const t = useT();
  const { fmt } = useDevise();
  const [filtres, setFiltres] = useState(VIDE);
  const [entrees, setEntrees] = useState<Entree[]>([]);
  const [categories, setCategories] = useState<Reponse["categories"]>([]);
  const [curseur, setCurseur] = useState<string | null>(null);
  const [charge, setCharge] = useState(true);
  const [erreur, setErreur] = useState<ErreurAppel | null>(null);
  // Les magasins et caisses des filtres viennent de la route des magasins (fondations).
  const lieux = useLecture<{ magasins: ListesFiltres["magasins"] }>("/api/pos/magasins");
  const tour = useRef(0);

  const requete = useMemo(() => {
    const p = new URLSearchParams();
    for (const cle of ["categorie", "magasinId", "caisseId"] as const) if (filtres[cle]) p.set(cle, filtres[cle]);
    if (filtres.du) p.set("debut", new Date(`${filtres.du}T00:00:00`).toISOString());
    if (filtres.au) p.set("fin", new Date(`${filtres.au}T23:59:59.999`).toISOString());
    return p.toString();
  }, [filtres]);

  const charger = useCallback(async (avant: string | null) => {
    const moi = ++tour.current;
    setCharge(true);
    const r = await appelPos<Reponse>(`/api/pos/journal?${requete}${avant ? `&avant=${encodeURIComponent(avant)}` : ""}`);
    if (moi !== tour.current) return;
    setCharge(false);
    if (!r.ok) { setErreur({ code: r.code, message: r.message }); return; }
    setErreur(null);
    setEntrees((e) => (avant ? [...e, ...r.donnees.entrees] : r.donnees.entrees));
    setCurseur(r.donnees.curseurSuivant);
    setCategories(r.donnees.categories);
  }, [requete]);
  useEffect(() => { void charger(null); }, [charger]);

  const choisir = (cle: keyof typeof VIDE) => (e: { target: { value: string } }) => setFiltres((f) => ({ ...f, [cle]: e.target.value, ...(cle === "magasinId" ? { caisseId: "" } : {}) }));
  const magasins = lieux.donnees?.magasins ?? [];
  const caisses = magasins.filter((m) => !filtres.magasinId || m.id === filtres.magasinId).flatMap((m) => m.caisses);
  const nomCaisse = (id: string | null) => magasins.flatMap((m) => m.caisses).find((c) => c.id === id)?.nom ?? null;
  const filtre = Object.values(filtres).some(Boolean);

  return (
    <Page>
      <EnTete titre="Journal d'activité" sousTitre="Tout ce qui s'est passé dans vos magasins, dans l'ordre : ventes, retours, caisse, stock, commandes fournisseur, scanners." >
        <Bouton variante="secondaire" taille="compact" onClick={() => void charger(null)} charge={charge && entrees.length > 0}>{t("Actualiser")}</Bouton>
      </EnTete>

      <section aria-label={t("Filtres")} className="rounded-2xl border border-[#E8E8E8] bg-white p-3 sm:p-4">
        <div role="group" aria-label={t("Famille")} className="flex flex-wrap gap-2">
          {[{ id: "", libelle: "Tout" }, ...categories].map((c) => (
            <button key={c.id || "tout"} type="button" aria-pressed={filtres.categorie === c.id} onClick={() => setFiltres((f) => ({ ...f, categorie: c.id }))}
              className={`min-h-11 rounded-xl px-4 text-[13px] font-bold transition-colors ${FOCUS} ${filtres.categorie === c.id ? "bg-[#111111] text-white" : "border border-[#E8E8E8] bg-white text-[#111111] hover:bg-[#F5F5F5]"}`}>
              {t(c.libelle)}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {magasins.length > 1 && (
            <Champ label="Magasin">{(a) => (
              <select {...a} className={CLASSE_SAISIE} value={filtres.magasinId} onChange={choisir("magasinId")}>
                <option value="">{t("Tous les magasins")}</option>{magasins.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>
            )}</Champ>
          )}
          {caisses.length > 1 && (
            <Champ label="Caisse">{(a) => (
              <select {...a} className={CLASSE_SAISIE} value={filtres.caisseId} onChange={choisir("caisseId")}>
                <option value="">{t("Toutes les caisses")}</option>{caisses.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            )}</Champ>
          )}
          <Saisie label="Du" type="date" value={filtres.du} max={filtres.au || undefined} onChange={choisir("du")} />
          <Saisie label="Au" type="date" value={filtres.au} min={filtres.du || undefined} onChange={choisir("au")} />
        </div>
      </section>

      <Carte>
        {erreur && entrees.length === 0 ? <EtatPos code={erreur.code} message={erreur.message} onReessayer={() => void charger(null)} />
          : charge && entrees.length === 0 ? <EtatChargement texte="Lecture du journal…" />
          : entrees.length === 0 ? (
            <EtatVide titre={filtre ? "Rien ne correspond à ces filtres" : "Le journal est vide"} texte={filtre ? "Élargissez la période ou changez de famille." : "Les opérations du magasin s'inscriront ici au fur et à mesure."}>
              {filtre && <Bouton variante="secondaire" onClick={() => setFiltres(VIDE)}>{t("Effacer les filtres")}</Bouton>}
            </EtatVide>
          ) : (
            <>
              <ul className="divide-y divide-[#F0F0F0]">
                {entrees.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-3">
                    <span className="w-28 flex-shrink-0 text-[11.5px] tabular-nums text-[#888888]">{dateHeure(e.createdAt, t.loc)}</span>
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-[#111111]">{t(e.titre)}<Badge ton={TONS_FAMILLE[e.categorie] ?? "neutre"}>{t(categories.find((c) => c.id === e.categorie)?.libelle ?? e.categorie)}</Badge></p>
                      <p className="mt-0.5 text-[12px] text-[#666666]">{[e.auteur, nomCaisse(e.caisseId), e.detail].filter(Boolean).join(" · ") || "—"}</p>
                    </div>
                    {e.montant !== null && <span className="flex-shrink-0 text-[13px] font-bold tabular-nums text-[#111111]">{fmt(e.montant)}</span>}
                  </li>
                ))}
              </ul>
              {erreur && <div className="mt-3"><EtatPos compact code={erreur.code} message={erreur.message} onReessayer={() => void charger(curseur)} /></div>}
              {curseur && <div className="mt-4 flex justify-center"><Bouton variante="secondaire" onClick={() => void charger(curseur)} charge={charge}>{t("Voir la suite")}</Bouton></div>}
            </>
          )}
      </Carte>
      <p className="text-[11.5px] leading-relaxed text-[#888888]">{t("Les scans et les connexions de scanners sont gardés 24 heures. Le reste est conservé dans le journal d'audit, qui montre aussi l'état avant et après chaque opération.")}</p>
    </Page>
  );
}
