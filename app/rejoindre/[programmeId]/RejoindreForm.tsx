"use client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Users, Percent, Clock, Award, CheckCircle2, Copy, Check, ArrowRight, Loader2 } from "lucide-react";
import { enregistrerAffiliationLocale, lireProfilAffilieLocal, sauverProfilAffilieLocal } from "@/lib/affiliation-local";

interface Props {
  programmeId: string;
  nomProgramme: string;
  description: string | null;
  typeCommission: string;
  valeurCommission: number;
  tiersActifs: boolean;
  tier1Nom: string;
  tier1Commission: number;
  tier3Nom: string;
  tier3Commission: number;
  dureeCookie: number;
  tenant: { nomBoutique: string; slug: string; logoUrl: string | null; devise: string };
}

export function RejoindreForm(p: Props) {
  const [form, setForm] = useState({ nom: "", email: "", telephone: "" });
  const [loading, setLoading] = useState(false);
  const [resultat, setResultat] = useState<{ portalToken: string; statut: string } | null>(null);
  const [copie, setCopie] = useState(false);

  // Préremplit avec le profil affilié déjà enregistré (créé via le
  // marketplace ou une précédente candidature) — évite de tout ressaisir.
  useEffect(() => {
    const profil = lireProfilAffilieLocal();
    if (profil) setForm({ nom: profil.nom, email: profil.email, telephone: profil.telephone || "" });
  }, []);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nom.trim() || !form.email.trim()) { toast.error("Nom et email obligatoires"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/affiliation/rejoindre", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programmeId: p.programmeId, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResultat(data.affilie);
      sauverProfilAffilieLocal({ nom: form.nom, email: form.email, telephone: form.telephone || undefined });
      enregistrerAffiliationLocale({
        portalToken: data.affilie.portalToken,
        nomBoutique: p.tenant.nomBoutique,
        logoUrl: p.tenant.logoUrl,
        nomProgramme: p.nomProgramme,
      });
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de l'inscription");
    } finally {
      setLoading(false);
    }
  }

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const portalUrl = resultat ? `${appUrl}/affilie/${resultat.portalToken}` : "";

  const inp = "w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#F5A623] transition-colors";

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAFA", fontFamily: "'Poppins',system-ui,sans-serif" }}>
      <div style={{ background: "linear-gradient(135deg,#111111,#1a1a1a)", padding: "40px 20px 80px", color: "white", textAlign: "center" }}>
        {p.tenant.logoUrl && <img src={p.tenant.logoUrl} alt="" style={{ height: 36, margin: "0 auto 16px", borderRadius: 8 }} />}
        <p style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
          Programme partenaires · {p.tenant.nomBoutique}
        </p>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 10 }}>{p.nomProgramme}</h1>
        {p.description && <p style={{ fontSize: 13, opacity: 0.7, maxWidth: 440, margin: "0 auto" }}>{p.description}</p>}
      </div>

      <div style={{ maxWidth: 460, margin: "-48px auto 0", padding: "0 20px 60px" }}>
        {/* Avantages */}
        <div style={{ background: "white", borderRadius: 20, padding: 20, boxShadow: "0 8px 30px rgba(0,0,0,0.08)", marginBottom: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ textAlign: "center" }}>
            <Percent size={18} color="#F5A623" style={{ margin: "0 auto 6px" }} />
            <p style={{ fontSize: 16, fontWeight: 800, color: "#111" }}>
              {p.tiersActifs ? `${p.tier1Commission}–${p.tier3Commission}%` : p.typeCommission === "fixe" ? `${p.valeurCommission} ${p.tenant.devise}` : `${p.valeurCommission}%`}
            </p>
            <p style={{ fontSize: 10.5, color: "#999" }}>{p.tiersActifs ? "Par palier" : "Commission"}</p>
          </div>
          <div style={{ textAlign: "center" }}>
            <Clock size={18} color="#3b82f6" style={{ margin: "0 auto 6px" }} />
            <p style={{ fontSize: 16, fontWeight: 800, color: "#111" }}>{p.dureeCookie}j</p>
            <p style={{ fontSize: 10.5, color: "#999" }}>Fenêtre d'attribution</p>
          </div>
        </div>

        {p.tiersActifs && (
          <div style={{ background: "#FFF8EC", border: "1px solid #F5A62330", borderRadius: 16, padding: 14, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <Award size={16} color="#F5A623" style={{ flexShrink: 0 }} />
            <p style={{ fontSize: 11.5, color: "#8a5c10" }}>
              Plus vous vendez, plus vous gagnez : de <b>{p.tier1Nom} ({p.tier1Commission}%)</b> jusqu'à <b>{p.tier3Nom} ({p.tier3Commission}%)</b>.
            </p>
          </div>
        )}

        {/* Formulaire ou confirmation */}
        {!resultat ? (
          <form onSubmit={soumettre} style={{ background: "white", borderRadius: 20, padding: 22, boxShadow: "0 4px 16px rgba(0,0,0,0.04)" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <Users size={15} color="#F5A623" /> Devenez partenaire
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input required placeholder="Nom complet" value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} className={inp} />
              <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inp} />
              <input placeholder="Téléphone (pour être payé)" value={form.telephone} onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))} className={inp} />
            </div>
            <button type="submit" disabled={loading}
              style={{ width: "100%", marginTop: 16, padding: "13px", borderRadius: 14, background: "#F5A623", color: "white", border: "none", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" }}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <>Rejoindre le programme <ArrowRight size={15} /></>}
            </button>
          </form>
        ) : (
          <div style={{ background: "white", borderRadius: 20, padding: 24, boxShadow: "0 4px 16px rgba(0,0,0,0.04)", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#10b98115", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <CheckCircle2 size={26} color="#10b981" />
            </div>
            <p style={{ fontSize: 15, fontWeight: 800, color: "#111", marginBottom: 6 }}>
              {resultat.statut === "actif" ? "Bienvenue dans le programme !" : "Candidature envoyée !"}
            </p>
            <p style={{ fontSize: 12.5, color: "#888", marginBottom: 18 }}>
              {resultat.statut === "actif"
                ? "Votre compte est actif. Enregistrez ce lien — c'est votre portail personnel."
                : "Le marchand va examiner votre candidature. Gardez ce lien précieusement, il deviendra actif dès l'approbation."}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FAFAFA", border: "1px solid #F0F0F0", borderRadius: 14, padding: "10px 14px", marginBottom: 14 }}>
              <span style={{ flex: 1, fontSize: 12, fontFamily: "monospace", color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{portalUrl}</span>
              <button onClick={() => { navigator.clipboard.writeText(portalUrl); setCopie(true); toast.success("Copié !"); setTimeout(() => setCopie(false), 2000); }}
                style={{ flexShrink: 0, background: "#F5A623", border: "none", borderRadius: 10, padding: "8px 12px", cursor: "pointer" }}>
                {copie ? <Check size={13} color="white" /> : <Copy size={13} color="white" />}
              </button>
            </div>
            <a href={portalUrl} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#F5A623", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
              Ouvrir mon portail <ArrowRight size={13} />
            </a>
            <p style={{ marginTop: 14 }}>
              <a href="/mon-espace-affilie" style={{ fontSize: 11.5, color: "#999", textDecoration: "underline" }}>
                Voir tous mes marchands dans un seul tableau de bord
              </a>
            </p>
          </div>
        )}

        <p style={{ textAlign: "center", fontSize: 11, color: "#BBB", marginTop: 24 }}>
          Propulsé par <span style={{ color: "#F5A623", fontWeight: 700 }}>Axso</span>
        </p>
      </div>
    </div>
  );
}
