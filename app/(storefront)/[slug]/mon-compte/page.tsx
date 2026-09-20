"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Package, Download, LogOut, User, Eye } from "lucide-react";

interface Compte {
  id: string;
  email: string;
  nom: string;
  telephone: string | null;
}

interface Commande {
  id: string;
  numero: string;
  statut: string;
  paiementStatut: string;
  montantTotal: number;
  devise: string;
  createdAt: string;
  trackingToken: string | null;
  lignes: Array<{
    id: string;
    nom: string;
    quantite: number;
    prix: number;
    produit: { id: string; nom: string; images: string[]; type: string; fichierUrl: string | null };
  }>;
  facture: { numero: string; statut: string } | null;
}

const STATUT_CONFIG: Record<string, { label: string; color: string }> = {
  en_attente: { label: "En attente", color: "#f59e0b" },
  confirmee: { label: "Confirmée", color: "#7c3aed" },
  en_preparation: { label: "En préparation", color: "#3b82f6" },
  expediee: { label: "Expédiée", color: "#0ea5e9" },
  livree: { label: "Livrée", color: "#10b981" },
  annulee: { label: "Annulée", color: "#ef4444" },
  remboursee: { label: "Remboursée", color: "#6b7280" },
};

export default function MonComptePage() {
  const params = useParams();
  const slug = params?.slug as string;
  const router = useRouter();

  const [view, setView] = useState<"login" | "register" | "compte">("login");
  const [compte, setCompte] = useState<Compte | null>(null);
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ email: "", password: "", nom: "", telephone: "" });

  const loadData = useCallback(async (token: string) => {
    const res = await fetch(`/api/clients-acheteurs/commandes?token=${token}&slug=${slug}`);
    const data = await res.json();
    if (res.ok) {
      setCompte(data.compte);
      setCommandes(data.commandes ?? []);
      setView("compte");
    } else {
      localStorage.removeItem(`axso_buyer_token_${slug}`);
    }
  }, [slug]);

  useEffect(() => {
    const token = localStorage.getItem(`axso_buyer_token_${slug}`);
    if (token) loadData(token);
  }, [slug, loadData]);

  async function submit(action: "connexion" | "inscription") {
    setLoading(true);
    setError("");
    const res = await fetch("/api/clients-acheteurs/connexion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, action, ...form }),
    });
    const data = await res.json();
    if (res.ok && data.token) {
      localStorage.setItem(`axso_buyer_token_${slug}`, data.token);
      await loadData(data.token);
    } else {
      setError(data.error ?? "Erreur inconnue");
    }
    setLoading(false);
  }

  function logout() {
    localStorage.removeItem(`axso_buyer_token_${slug}`);
    setCompte(null);
    setCommandes([]);
    setView("login");
  }

  // Login / register form
  if (view !== "compte") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] px-4">
        <div className="bg-white rounded-2xl border border-[#F0F0F0] p-8 w-full max-w-sm shadow-sm">
          <div className="mb-6 text-center">
            <p className="text-xl font-bold text-[#111]">Mon compte</p>
            <p className="text-[12px] text-[#888] mt-1">{view === "login" ? "Connecte-toi pour suivre tes commandes" : "Crée ton compte acheteur"}</p>
          </div>

          {error && (
            <div className="mb-4 px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-[12px] text-red-600">{error}</div>
          )}

          <div className="space-y-3">
            {view === "register" && (
              <>
                <div>
                  <label className="block text-[11px] text-[#888] mb-1">Nom complet</label>
                  <input className="w-full border border-[#E5E5E5] rounded-xl px-3 py-2.5 text-[13px]" placeholder="Jean Dupont" value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-[11px] text-[#888] mb-1">Téléphone (optionnel)</label>
                  <input className="w-full border border-[#E5E5E5] rounded-xl px-3 py-2.5 text-[13px]" placeholder="+237 6XX XXX XXX" value={form.telephone} onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))} />
                </div>
              </>
            )}
            <div>
              <label className="block text-[11px] text-[#888] mb-1">Email</label>
              <input type="email" className="w-full border border-[#E5E5E5] rounded-xl px-3 py-2.5 text-[13px]" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[11px] text-[#888] mb-1">Mot de passe</label>
              <input type="password" className="w-full border border-[#E5E5E5] rounded-xl px-3 py-2.5 text-[13px]" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
            </div>
          </div>

          <button
            onClick={() => submit(view === "login" ? "connexion" : "inscription")}
            disabled={loading}
            className="w-full mt-5 py-3 rounded-xl text-white font-semibold text-[14px] disabled:opacity-50"
            style={{ background: "#F5A623" }}
          >
            {loading ? "..." : view === "login" ? "Se connecter" : "Créer mon compte"}
          </button>

          <p className="text-center text-[12px] text-[#888] mt-4">
            {view === "login" ? (
              <>Pas encore de compte ?{" "}
                <button className="text-[#F5A623] font-semibold" onClick={() => { setView("register"); setError(""); }}>Créer un compte</button>
              </>
            ) : (
              <>Déjà un compte ?{" "}
                <button className="text-[#F5A623] font-semibold" onClick={() => { setView("login"); setError(""); }}>Se connecter</button>
              </>
            )}
          </p>

          <div className="mt-4 text-center">
            <Link href={`/${slug}`} className="text-[12px] text-[#888] hover:text-[#111]">← Retour à la boutique</Link>
          </div>
        </div>
      </div>
    );
  }

  // Account dashboard
  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#F5A623] flex items-center justify-center">
              <User size={18} className="text-white" />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-[#111]">{compte?.nom}</p>
              <p className="text-[12px] text-[#888]">{compte?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/${slug}`} className="text-[12px] text-[#888] hover:text-[#111] px-3 py-1.5 rounded-lg border border-[#E5E5E5]">
              Boutique
            </Link>
            <button onClick={logout} className="flex items-center gap-1.5 text-[12px] text-[#888] hover:text-red-500 px-3 py-1.5 rounded-lg border border-[#E5E5E5]">
              <LogOut size={12} /> Déconnexion
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-[#F0F0F0] p-4">
            <p className="text-[11px] text-[#888]">Commandes</p>
            <p className="text-2xl font-bold text-[#111]">{commandes.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-[#F0F0F0] p-4">
            <p className="text-[11px] text-[#888]">Total dépensé</p>
            <p className="text-2xl font-bold text-[#111]">
              {commandes
                .filter((c) => !["annulee", "remboursee"].includes(c.statut))
                .reduce((s, c) => s + c.montantTotal, 0)
                .toLocaleString()}
            </p>
          </div>
        </div>

        {/* Commandes */}
        <h2 className="text-[14px] font-semibold text-[#111] mb-3">Mes commandes</h2>
        {commandes.length === 0 ? (
          <div className="bg-white border border-dashed border-[#E5E5E5] rounded-xl p-10 text-center">
            <Package size={28} className="mx-auto mb-3 text-[#DDD]" />
            <p className="text-[13px] text-[#888]">Aucune commande pour l'instant.</p>
            <Link href={`/${slug}`} className="mt-4 inline-block px-4 py-2 rounded-xl text-white text-[13px] font-semibold" style={{ background: "#F5A623" }}>
              Découvrir la boutique
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {commandes.map((c) => {
              const sc = STATUT_CONFIG[c.statut] ?? { label: c.statut, color: "#888" };
              const hasDigital = c.lignes.some((l) => l.produit.type === "digital" && l.produit.fichierUrl);
              return (
                <div key={c.id} className="bg-white border border-[#F0F0F0] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-[13px] font-semibold text-[#111] font-mono">{c.numero}</p>
                      <p className="text-[11px] text-[#888]">{new Date(c.createdAt).toLocaleDateString("fr")}</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold text-white" style={{ background: sc.color }}>{sc.label}</span>
                      <p className="text-[13px] font-bold text-[#111] mt-1">{c.montantTotal.toLocaleString()} {c.devise}</p>
                    </div>
                  </div>

                  {/* Produits */}
                  <div className="space-y-2">
                    {c.lignes.map((l) => (
                      <div key={l.id} className="flex items-center gap-3">
                        {l.produit.images?.[0] && (
                          <img src={l.produit.images[0]} alt={l.nom} className="w-10 h-10 rounded-lg object-cover bg-[#F5F5F5]" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] text-[#444] truncate">{l.nom}</p>
                          <p className="text-[10px] text-[#888]">x{l.quantite} · {l.prix.toLocaleString()} {c.devise}</p>
                        </div>
                        {l.produit.type === "digital" && l.produit.fichierUrl && c.statut === "livree" && (
                          <a
                            href={l.produit.fichierUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white"
                            style={{ background: "#7c3aed" }}
                          >
                            <Download size={11} /> Télécharger
                          </a>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#F0F0F0]">
                    {c.facture && (
                      <span className="text-[11px] text-[#888]">Facture {c.facture.numero}</span>
                    )}
                    {c.trackingToken && (
                      <Link href={`/${slug}/tracking/${c.trackingToken}`} className="flex items-center gap-1.5 text-[11px] text-[#F5A623] font-semibold ml-auto">
                        <Eye size={11} /> Suivre
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
