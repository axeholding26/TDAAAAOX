"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserPlus, CheckCircle2, Pencil } from "lucide-react";
import { lireProfilAffilieLocal, sauverProfilAffilieLocal, type ProfilAffilie } from "@/lib/affiliation-local";

// Panneau du hero du marketplace : permet à n'importe quel visiteur de créer
// son "compte affilié" (nom/email/téléphone, stocké dans son navigateur) en
// une seule fois, sans devoir d'abord choisir un produit. Une fois créé,
// chaque bouton "Devenir affilié" de la page rejoint le programme du
// marchand en un clic (cf. DevenirAffilieButton).
export function AffiliateAccountPanel() {
  const [profil, setProfil] = useState<ProfilAffilie | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ nom: "", email: "", telephone: "" });

  useEffect(() => {
    const p = lireProfilAffilieLocal();
    setProfil(p);
    if (p) setForm({ nom: p.nom, email: p.email, telephone: p.telephone || "" });
  }, []);

  function creer(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nom.trim() || !form.email.trim()) { toast.error("Nom et email obligatoires"); return; }
    const nouveau = { nom: form.nom.trim(), email: form.email.trim(), telephone: form.telephone.trim() || undefined };
    sauverProfilAffilieLocal(nouveau);
    setProfil(nouveau);
    setEditing(false);
    toast.success("Compte affilié prêt ! Cliquez sur \"Devenir affilié\" sur n'importe quel produit ci-dessous.");
  }

  const inp = "w-full px-4 py-2.5 text-sm rounded-xl border outline-none";
  const inpStyle = { borderColor: "rgba(0,0,0,0.1)" };

  if (profil === undefined) return null; // évite un flash avant lecture du localStorage

  if (profil && !editing) {
    return (
      <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-2xl mb-2"
        style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)" }}>
        <CheckCircle2 size={15} style={{ color: "#10b981" }} />
        <span className="text-sm font-semibold" style={{ color: "#0d9467" }}>
          Compte affilié prêt — {profil.nom}
        </span>
        <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs font-medium" style={{ color: "#0d9467", opacity: 0.7 }}>
          <Pencil size={11} /> Modifier
        </button>
      </div>
    );
  }

  if (editing) {
    return (
      <form onSubmit={creer} className="max-w-md mx-auto rounded-2xl p-5 text-left"
        style={{ background: "white", border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 8px 30px rgba(0,0,0,0.06)" }}>
        <p className="text-sm font-bold mb-3">Créer mon compte affilié</p>
        <div className="space-y-2.5">
          <input required placeholder="Nom complet" value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} className={inp} style={inpStyle} />
          <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inp} style={inpStyle} />
          <input placeholder="Téléphone (pour être payé)" value={form.telephone} onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))} className={inp} style={inpStyle} />
        </div>
        <div className="flex gap-2 mt-3">
          <button type="submit" className="flex-1 py-2.5 rounded-xl text-sm font-bold" style={{ background: "#F5A623", color: "#080808" }}>
            Créer mon compte
          </button>
          {profil && (
            <button type="button" onClick={() => setEditing(false)} className="px-4 py-2.5 rounded-xl text-sm font-medium" style={{ border: "1px solid rgba(0,0,0,0.1)", color: "#666" }}>
              Annuler
            </button>
          )}
        </div>
      </form>
    );
  }

  return (
    <button onClick={() => setEditing(true)}
      className="inline-flex items-center gap-2 font-bold px-6 py-3 rounded-2xl transition-all hover:scale-105 mb-2"
      style={{ border: "2px solid #F5A623", color: "#F5A623", background: "rgba(245,166,35,0.06)" }}>
      <UserPlus size={16} /> Créer mon compte affilié
    </button>
  );
}
