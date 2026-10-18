"use client";
// Éditeurs des réglages du Command Center. Enregistrement : PUT /api/admin/command-center/reglages
// (validé par schéma côté serveur, journalisé). En lecture seule, tout est désactivé.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Format } from "@/lib/command-center/moteur";
import { CRITERES_SANTE, NOM_CRITERE, NOM_ETAPE, type Seuil, type Objectif, type PoidsSante, type Reglages } from "@/lib/command-center/reglages";

export interface MetriqueOption { id: string; nom: string; format: Format }

function useEnregistrer<K extends keyof Reglages>(cle: K) {
  const router = useRouter();
  const [charge, setCharge] = useState(false);
  const enregistrer = async (valeur: Reglages[K]) => {
    setCharge(true);
    const r = await fetch("/api/admin/command-center/reglages", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cle, valeur }) }).catch(() => null);
    const d = await r?.json().catch(() => ({}));
    setCharge(false);
    if (!r?.ok) { toast.error(d?.erreur ?? "Enregistrement impossible"); return; }
    toast.success(d?.message ?? "Réglage enregistré");
    router.refresh();
  };
  return { charge, enregistrer };
}

function BoutonEnregistrer({ charge, onClick, desactive }: { charge: boolean; onClick: () => void; desactive: boolean }) {
  return <button className="cc-btn cc-btn-primary cc-btn-sm" disabled={desactive || charge} onClick={onClick}>{charge ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}Enregistrer</button>;
}

// Les pourcentages et les variations sont saisis en % puis stockés en fraction (12 % → 0,12).
const enPourcent = (s: Pick<Seuil, "condition">, f?: Format) => s.condition.startsWith("variation") || f === "pct";
const unite = (s: Pick<Seuil, "condition">, f?: Format) => s.condition.startsWith("variation") ? (f === "pct" ? "pt" : "%") : f === "pct" ? "%" : f === "xaf" ? "FCFA" : f === "heures" ? "h" : f === "ratio" ? "×" : "";
const arrondi = (x: number) => Math.round(x * 1e6) / 1e6;

const CONDITIONS: { id: Seuil["condition"]; nom: string }[] = [
  { id: "variation_inf", nom: "variation <" }, { id: "variation_sup", nom: "variation >" }, { id: "valeur_inf", nom: "valeur <" }, { id: "valeur_sup", nom: "valeur >" },
];

export function EditeurSeuils({ initial, metriques, lecture }: { initial: Seuil[]; metriques: MetriqueOption[]; lecture: boolean }) {
  const [seuils, setSeuils] = useState(initial);
  const { charge, enregistrer } = useEnregistrer("seuils");
  const fmt = (id: string) => metriques.find((m) => m.id === id)?.format;
  const maj = (i: number, p: Partial<Seuil>) => setSeuils(seuils.map((s, j) => (j === i ? { ...s, ...p } : s)));
  const ajouter = () => setSeuils([...seuils, { id: `s${Date.now().toString(36)}`, metrique: metriques[0].id, condition: "valeur_inf", valeur: 0, gravite: "alerte", canal: "tableau", actif: true }]);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto -mx-4">
        <table className="cc-table">
          <thead><tr><th>Métrique</th><th>Condition</th><th>Seuil</th><th>Gravité</th><th>Canal</th><th>Actif</th><th><span className="sr-only">Supprimer</span></th></tr></thead>
          <tbody>
            {seuils.map((s, i) => {
              const f = fmt(s.metrique), pc = enPourcent(s, f);
              return (
                <tr key={s.id}>
                  <td><select className="cc-select" disabled={lecture} value={s.metrique} onChange={(e) => maj(i, { metrique: e.target.value })} aria-label="Métrique">{metriques.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}</select></td>
                  <td><select className="cc-select" disabled={lecture} value={s.condition} onChange={(e) => maj(i, { condition: e.target.value as Seuil["condition"] })} aria-label="Condition">{CONDITIONS.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}</select></td>
                  <td className="whitespace-nowrap">
                    <input className="cc-input w-24 text-right" type="number" step="any" disabled={lecture} aria-label="Seuil"
                      value={pc ? arrondi(s.valeur * 100) : s.valeur} onChange={(e) => { const x = Number(e.target.value); if (Number.isFinite(x)) maj(i, { valeur: pc ? x / 100 : x }); }} />
                    <span className="cc-faint text-[12px] ml-1.5">{unite(s, f)}</span>
                  </td>
                  <td><select className="cc-select" disabled={lecture} value={s.gravite} onChange={(e) => maj(i, { gravite: e.target.value as Seuil["gravite"] })} aria-label="Gravité"><option value="critique">Critique</option><option value="alerte">Alerte</option></select></td>
                  <td><select className="cc-select" disabled={lecture} value={s.canal} onChange={(e) => maj(i, { canal: e.target.value as Seuil["canal"] })} aria-label="Canal"><option value="tableau">Tableau de bord</option><option value="email">E-mail (rapport quotidien)</option></select></td>
                  <td><input type="checkbox" disabled={lecture} checked={s.actif} onChange={(e) => maj(i, { actif: e.target.checked })} aria-label="Seuil actif" /></td>
                  <td>{!lecture && <button className="cc-btn cc-btn-ghost cc-btn-sm" onClick={() => setSeuils(seuils.filter((_, j) => j !== i))} aria-label="Supprimer le seuil"><Trash2 size={13} /></button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!lecture && (
        <div className="flex flex-wrap items-center gap-2">
          <button className="cc-btn cc-btn-sm" onClick={ajouter} disabled={seuils.length >= 50}><Plus size={13} />Ajouter un seuil</button>
          <BoutonEnregistrer charge={charge} desactive={false} onClick={() => enregistrer(seuils)} />
          <span className="cc-faint text-[11.5px]">Variation : écart relatif (%) ou, pour un pourcentage, en points (pt). Les seuils « e-mail » sont envoyés dans le rapport quotidien programmé.</span>
        </div>
      )}
    </div>
  );
}

export function EditeurObjectifs({ initial, metriques, lecture }: { initial: Objectif[]; metriques: MetriqueOption[]; lecture: boolean }) {
  const [objectifs, setObjectifs] = useState(initial);
  const { charge, enregistrer } = useEnregistrer("objectifs");
  const options = [...metriques, { id: "pays", nom: "Pays actifs", format: "nombre" as Format }];
  const fmt = (id: string) => options.find((m) => m.id === id)?.format;
  const maj = (i: number, p: Partial<Objectif>) => setObjectifs(objectifs.map((o, j) => (j === i ? { ...o, ...p } : o)));
  const invalide = objectifs.some((o) => !(o.cible > 0));

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {objectifs.map((o, i) => {
          const pc = fmt(o.metrique) === "pct";
          return (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <select className="cc-select min-w-[200px]" disabled={lecture} value={o.metrique} onChange={(e) => maj(i, { metrique: e.target.value })} aria-label="Métrique de l'objectif">{options.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}</select>
              <span className="cc-faint text-[12px]">cible</span>
              <input className="cc-input w-32 text-right" type="number" min={0} step="any" disabled={lecture} aria-label="Cible" value={pc ? arrondi(o.cible * 100) : o.cible} onChange={(e) => { const x = Number(e.target.value); maj(i, { cible: pc ? x / 100 : x }); }} />
              <span className="cc-faint text-[12px] w-10">{pc ? "%" : fmt(o.metrique) === "xaf" ? "FCFA" : ""}</span>
              {!lecture && <button className="cc-btn cc-btn-ghost cc-btn-sm" onClick={() => setObjectifs(objectifs.filter((_, j) => j !== i))} aria-label="Supprimer l'objectif"><Trash2 size={13} /></button>}
            </li>
          );
        })}
      </ul>
      {!lecture && (
        <div className="flex flex-wrap items-center gap-2">
          <button className="cc-btn cc-btn-sm" disabled={objectifs.length >= 20} onClick={() => setObjectifs([...objectifs, { metrique: "gmv", cible: 1_000_000 }])}><Plus size={13} />Ajouter un objectif</button>
          <BoutonEnregistrer charge={charge} desactive={invalide} onClick={() => enregistrer(objectifs)} />
          {invalide && <span className="cc-bad text-[12px]">Chaque cible doit être supérieure à 0.</span>}
        </div>
      )}
    </div>
  );
}

export function EditeurPoids({ initial, lecture }: { initial: PoidsSante; lecture: boolean }) {
  const [poids, setPoids] = useState(initial);
  const { charge, enregistrer } = useEnregistrer("poids_sante");
  const total = CRITERES_SANTE.reduce((s, c) => s + (poids[c] || 0), 0);
  return (
    <div className="space-y-3">
      <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {CRITERES_SANTE.map((c) => (
          <label key={c} className="flex items-center justify-between gap-3 text-[13px]">
            <span>{NOM_CRITERE[c]}</span>
            <span className="flex items-center gap-1.5">
              <input className="cc-input w-20 text-right" type="number" min={0} max={100} step={1} disabled={lecture} value={poids[c]} onChange={(e) => setPoids({ ...poids, [c]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} aria-label={`Poids : ${NOM_CRITERE[c]}`} />
              <span className="cc-faint text-[12px] w-8">{total ? `${Math.round((poids[c] / total) * 100)} %` : "—"}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 pt-2 border-t cc-sep">
        <p className="text-[13px]">Total : <strong className={`cc-num ${total === 100 ? "" : "cc-warn"}`}>{total}</strong> <span className="cc-faint text-[12px]">{total === 100 ? "" : "— les poids sont normalisés (seule la proportion compte), un total de 100 est plus lisible."}</span></p>
        {!lecture && <BoutonEnregistrer charge={charge} desactive={total === 0} onClick={() => enregistrer(poids)} />}
      </div>
    </div>
  );
}

export function EditeurActivation({ initial, lecture }: { initial: Reglages["activation"]; lecture: boolean }) {
  const [etape, setEtape] = useState(initial);
  const { charge, enregistrer } = useEnregistrer("activation");
  return (
    <div className="space-y-3">
      <fieldset className="grid gap-2 sm:grid-cols-2" disabled={lecture}>
        <legend className="sr-only">Étape d'activation</legend>
        {(Object.keys(NOM_ETAPE) as Reglages["activation"][]).map((e) => (
          <label key={e} className="flex items-center gap-2 text-[13px] cc-card px-3 py-2 cursor-pointer">
            <input type="radio" name="activation" value={e} checked={etape === e} onChange={() => setEtape(e)} />{NOM_ETAPE[e]}
          </label>
        ))}
      </fieldset>
      {!lecture && <BoutonEnregistrer charge={charge} desactive={etape === initial} onClick={() => enregistrer(etape)} />}
    </div>
  );
}
