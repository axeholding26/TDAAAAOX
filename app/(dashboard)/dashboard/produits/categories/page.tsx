"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Loader2, Tags, X, Check } from "lucide-react";

// Catalogue → Catégories : les catégories de la boutique et, pour chacune,
// les options de variantes proposées dans le formulaire produit
// (ex. Jeans → Taille 28/30/32, Couleur Bleu/Noir).
type Option = { nom: string; valeurs: string[] };
type Categorie = { id: string; nom: string; options: Option[]; ordre: number; nbProduits: number };

const SUGGESTIONS = ["Taille", "Couleur", "Pointure", "Matière", "Contenance", "Poids", "Modèle", "Parfum"];
const INPUT = "w-full h-10 px-3 rounded-xl border border-[#E8E8E8] bg-white text-[14px] text-[#111111] placeholder:text-[#BBBBBB] outline-none focus:border-[#F5A623] focus:ring-2 focus:ring-[#F5A623]/20";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Categorie[] | null>(null);
  const [edition, setEdition] = useState<string | "nouvelle" | null>(null);

  const charger = () => fetch("/api/categories").then((r) => r.json()).then((d) => setCategories(d.categories ?? [])).catch(() => setCategories([]));
  useEffect(() => { charger(); }, []);

  const supprimer = async (c: Categorie) => {
    if (!confirm(`Supprimer la catégorie « ${c.nom} » ?${c.nbProduits ? `\n\n${c.nbProduits} produit(s) resteront en ligne, sans catégorie.` : ""}`)) return;
    const r = await fetch(`/api/categories/${c.id}`, { method: "DELETE" });
    if (!r.ok) return void toast.error((await r.json()).error ?? "Suppression impossible");
    toast.success("Catégorie supprimée"); charger();
  };
  const deplacer = async (i: number, sens: -1 | 1) => {
    if (!categories) return;
    const liste = [...categories]; const [x] = liste.splice(i, 1); liste.splice(i + sens, 0, x);
    setCategories(liste);
    await Promise.all(liste.map((c, ordre) => c.ordre !== ordre && fetch(`/api/categories/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ordre }) })));
    charger();
  };

  return (
    <div className="space-y-5 max-w-3xl w-full" style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <div className="flex flex-wrap items-end justify-between gap-3 pt-1">
        <div>
          <h1 className="text-[20px] font-bold text-[#111111] tracking-tight">Catégories</h1>
          <p className="text-[12.5px] text-[#AAAAAA] mt-0.5 max-w-lg">Les catégories de ta boutique (filtres du catalogue) et les options proposées pour leurs produits : tailles, couleurs, pointures…</p>
        </div>
        <button onClick={() => setEdition("nouvelle")} disabled={edition === "nouvelle"}
          className="h-10 px-4 rounded-xl inline-flex items-center gap-2 text-[14px] font-semibold bg-[#F5A623] text-[#111111] hover:bg-[#E8990F] disabled:opacity-50">
          <Plus size={16} /> Nouvelle catégorie
        </button>
      </div>

      {edition === "nouvelle" && <Editeur onFini={() => { setEdition(null); charger(); }} />}

      {!categories ? (
        <div className="flex justify-center py-16 text-[#AAAAAA]"><Loader2 size={20} className="animate-spin" /></div>
      ) : !categories.length && edition !== "nouvelle" ? (
        <div className="ax-card p-8 text-center">
          <Tags size={28} className="mx-auto text-[#F5A623]" />
          <p className="text-[15px] font-semibold text-[#111111] mt-3">Aucune catégorie pour l'instant</p>
          <p className="text-[13px] text-[#888888] mt-1">Crée tes catégories (Jeans, Chemises…) : elles serviront de filtres dans ton catalogue.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {categories.map((c, i) => edition === c.id ? (
            <li key={c.id}><Editeur categorie={c} onFini={() => { setEdition(null); charger(); }} /></li>
          ) : (
            <li key={c.id} className="ax-card p-4 flex items-start gap-3">
              <div className="flex flex-col gap-1 flex-shrink-0 pt-0.5">
                <button onClick={() => deplacer(i, -1)} disabled={i === 0} aria-label="Monter" className="w-7 h-7 rounded-lg flex items-center justify-center text-[#999999] hover:bg-[#F5F5F5] disabled:opacity-25"><ArrowUp size={14} /></button>
                <button onClick={() => deplacer(i, 1)} disabled={i === categories.length - 1} aria-label="Descendre" className="w-7 h-7 rounded-lg flex items-center justify-center text-[#999999] hover:bg-[#F5F5F5] disabled:opacity-25"><ArrowDown size={14} /></button>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-[#111111] truncate">{c.nom}</p>
                <p className="text-[12px] text-[#999999]">{c.nbProduits} produit{c.nbProduits > 1 ? "s" : ""}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {c.options.length ? c.options.map((o) => (
                    <span key={o.nom} className="text-[12px] px-2 py-0.5 rounded-full bg-[#FFF8EC] text-[#8A5300] border border-[#FDE68A]/70">
                      {o.nom}{o.valeurs.length ? ` · ${o.valeurs.slice(0, 4).join(", ")}${o.valeurs.length > 4 ? "…" : ""}` : ""}
                    </span>
                  )) : <span className="text-[12px] text-[#BBBBBB]">Aucune option</span>}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => setEdition(c.id)} aria-label={`Modifier ${c.nom}`} className="w-9 h-9 rounded-lg flex items-center justify-center text-[#666666] hover:bg-[#F5F5F5] hover:text-[#111111]"><Pencil size={15} /></button>
                <button onClick={() => supprimer(c)} aria-label={`Supprimer ${c.nom}`} className="w-9 h-9 rounded-lg flex items-center justify-center text-[#999999] hover:bg-[#FEF2F2] hover:text-[#DC2626]"><Trash2 size={15} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Editeur({ categorie, onFini }: { categorie?: Categorie; onFini: () => void }) {
  const [nom, setNom] = useState(categorie?.nom ?? "");
  const [options, setOptions] = useState<Option[]>(categorie?.options ?? []);
  const [saisie, setSaisie] = useState<Record<number, string>>({});
  const [envoi, setEnvoi] = useState(false);
  const maj = (i: number, patch: Partial<Option>) => setOptions((l) => l.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  const ajouterValeur = (i: number) => {
    const v = (saisie[i] ?? "").trim();
    if (v && !options[i].valeurs.includes(v)) maj(i, { valeurs: [...options[i].valeurs, v] });
    setSaisie((s) => ({ ...s, [i]: "" }));
  };

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim()) return;
    setEnvoi(true);
    try {
      const r = await fetch(categorie ? `/api/categories/${categorie.id}` : "/api/categories", {
        method: categorie ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: nom.trim(), options: options.filter((o) => o.nom.trim()) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(categorie ? "Catégorie modifiée" : "Catégorie créée");
      onFini();
    } catch (err) { toast.error(err instanceof Error && err.message ? err.message : "Enregistrement impossible"); } finally { setEnvoi(false); }
  };

  return (
    <form onSubmit={enregistrer} className="ax-card p-4 sm:p-5 space-y-4 border-2 border-[#F5A623]/40">
      <label className="block">
        <span className="block text-[13px] font-semibold text-[#555555] mb-1.5">Nom de la catégorie</span>
        <input autoFocus value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex : Jeans" maxLength={60} className={INPUT} />
        {categorie && categorie.nbProduits > 0 && nom.trim() !== categorie.nom && <span className="block text-[12px] text-[#8A5300] mt-1">Les {categorie.nbProduits} produit(s) de cette catégorie seront renommés aussi.</span>}
      </label>

      <div className="space-y-2.5">
        <p className="text-[13px] font-semibold text-[#555555]">Options des produits <span className="font-normal text-[#AAAAAA]">— proposées au moment de créer les variantes</span></p>
        {options.map((o, i) => (
          <div key={i} className="rounded-xl bg-[#FAFAFA] border border-[#F0F0F0] p-3 space-y-2">
            <div className="flex gap-2">
              <input value={o.nom} onChange={(e) => maj(i, { nom: e.target.value })} placeholder="Nom de l'option (ex : Taille)" maxLength={40} className={`${INPUT} min-w-0`} />
              <button type="button" onClick={() => setOptions((l) => l.filter((_, j) => j !== i))} aria-label="Retirer l'option" className="w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center text-[#999999] hover:bg-[#FEF2F2] hover:text-[#DC2626]"><Trash2 size={15} /></button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {o.valeurs.map((v) => (
                <span key={v} className="inline-flex items-center gap-1 text-[12.5px] pl-2.5 pr-1 py-1 rounded-full bg-white border border-[#E8E8E8]">
                  {v}<button type="button" onClick={() => maj(i, { valeurs: o.valeurs.filter((x) => x !== v) })} aria-label={`Retirer ${v}`} className="w-5 h-5 rounded-full flex items-center justify-center text-[#999999] hover:text-[#DC2626]"><X size={12} /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={saisie[i] ?? ""} onChange={(e) => setSaisie((s) => ({ ...s, [i]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); ajouterValeur(i); } }}
                placeholder="Ajouter une valeur (ex : XL) puis Entrée" className={`${INPUT} min-w-0`} />
              <button type="button" onClick={() => ajouterValeur(i)} className="h-10 px-3 flex-shrink-0 rounded-xl border border-[#E8E8E8] text-[13px] font-medium text-[#555555] hover:border-[#F5A623]">Ajouter</button>
            </div>
          </div>
        ))}
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.filter((s) => !options.some((o) => o.nom.toLowerCase() === s.toLowerCase())).map((s) => (
            <button key={s} type="button" onClick={() => setOptions((l) => [...l, { nom: s, valeurs: [] }])}
              className="text-[12.5px] px-2.5 py-1 rounded-full border border-dashed border-[#D8D8D8] text-[#666666] hover:border-[#F5A623] hover:text-[#111111]">+ {s}</button>
          ))}
          <button type="button" onClick={() => setOptions((l) => [...l, { nom: "", valeurs: [] }])}
            className="text-[12.5px] px-2.5 py-1 rounded-full border border-dashed border-[#D8D8D8] text-[#666666] hover:border-[#F5A623] hover:text-[#111111]">+ Autre option</button>
        </div>
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <button type="button" onClick={onFini} className="h-10 px-4 rounded-xl text-[14px] font-medium text-[#555555] border border-[#E8E8E8] hover:bg-[#F7F7F7]">Annuler</button>
        <button type="submit" disabled={!nom.trim() || envoi}
          className="h-10 px-5 rounded-xl inline-flex items-center justify-center gap-2 text-[14px] font-semibold bg-[#111111] text-white hover:bg-[#333333] disabled:opacity-40">
          {envoi ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Enregistrer
        </button>
      </div>
    </form>
  );
}
