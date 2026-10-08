"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Package, Download, LogOut, User, Eye } from "lucide-react";
import { useT } from "@/components/I18nProvider";

interface Compte {
  id: string;
  email: string | null; // null : compte ouvert par le lien personnel (commandes retrouvées par le téléphone)
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
    produit: { id: string; nom: string; images: string[]; type: string };
  }>;
  facture: { numero: string; statut: string } | null;
  accesDigital: boolean; // achat digital payé : page d'accès aux fichiers / formation / clés
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

// Dans une boutique à design, la page est entourée de l'en-tête et du pied de
// page du design (voir page.tsx) : plus de plein écran gris, juste le contenu.
// `lien` : jeton du lien de suivi (/mon-compte?lien=…), qui ouvre le compte sans code.
export function MonCompteClient({ habille = false, lien }: { habille?: boolean; lien?: string }) {
  const t = useT();
  const params = useParams();
  const slug = params?.slug as string;

  // Connexion sans mot de passe : lien personnel (depuis le suivi de commande), ou email → code par email.
  const [view, setView] = useState<"identifiant" | "code" | "compte">("identifiant");
  const [compte, setCompte] = useState<Compte | null>(null);
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

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
    if (lien) {
      // Jeton retiré de l'adresse (historique, partage d'écran) dès qu'il a servi.
      window.history.replaceState(null, "", `/${slug}/mon-compte`);
      setLoading(true);
      fetch("/api/clients-acheteurs/connexion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, lien }) })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.token) { localStorage.setItem(`axso_buyer_token_${slug}`, data.token); await loadData(data.token); }
          else setError(data.error ?? "Lien invalide ou expiré");
        })
        .finally(() => setLoading(false));
      return;
    }
    const token = localStorage.getItem(`axso_buyer_token_${slug}`);
    if (token) loadData(token);
  }, [slug, lien, loadData]);

  async function envoyer(avecCode: boolean) {
    setLoading(true);
    setError("");
    const res = await fetch("/api/clients-acheteurs/connexion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, email, ...(avecCode ? { code } : {}) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error ?? "Erreur inconnue");
    else if (!avecCode) { setView("code"); setCode(""); }
    else if (data.token) {
      localStorage.setItem(`axso_buyer_token_${slug}`, data.token);
      await loadData(data.token);
    }
    setLoading(false);
  }

  function logout() {
    localStorage.removeItem(`axso_buyer_token_${slug}`);
    setCompte(null);
    setCommandes([]);
    setView("identifiant");
  }

  // Login / register form
  if (view !== "compte") {
    return (
      <div className={`flex items-center justify-center px-4 ${habille ? "py-20" : "min-h-screen bg-[#FAFAFA]"}`}>
        <div className="bg-white rounded-2xl border border-[#F0F0F0] p-8 w-full max-w-sm shadow-sm">
          <div className="mb-6 text-center">
            <p className="text-xl font-bold text-[#111]">{t("Mon compte")}</p>
            <p className="text-[12px] text-[#888] mt-1">
              {view === "identifiant" ? t("Vos achats et vos téléchargements, avec votre email") : t("Code envoyé à {0}", email)}
            </p>
          </div>

          {error && (
            <div className="mb-4 px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-[12px] text-red-600">{t(error)}</div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); envoyer(view === "code"); }} className="space-y-3">
            {view === "identifiant" ? (
              <div>
                <label className="block text-[11px] text-[#888] mb-1">{t("Email utilisé lors de l'achat")}</label>
                <input type="email" required autoFocus autoComplete="email" className="w-full border border-[#E5E5E5] rounded-xl px-3 py-2.5 text-[13px]" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            ) : (
              <div>
                <label className="block text-[11px] text-[#888] mb-1">{t("Code à 6 chiffres")}</label>
                <input inputMode="numeric" required autoFocus autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}"
                  className="w-full border border-[#E5E5E5] rounded-xl px-3 py-2.5 text-[18px] tracking-[0.5em] text-center font-semibold" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
              </div>
            )}
            <button type="submit" disabled={loading}
              className="w-full mt-2 py-3 rounded-xl text-white font-semibold text-[14px] disabled:opacity-50" style={{ background: "#F5A623" }}>
              {loading ? "..." : view === "identifiant" ? t("Recevoir mon code") : t("Accéder à mes achats")}
            </button>
          </form>

          {view === "identifiant" && (
            <p className="text-center text-[12px] text-[#888] mt-4 leading-relaxed">
              {t("Commandé sans email ? Ouvrez le lien de suivi reçu sur WhatsApp après votre commande, puis touchez « Voir toutes mes commandes ».")}
            </p>
          )}

          {view === "code" && (
            <p className="text-center text-[12px] text-[#888] mt-4">
              <button className="text-[#F5A623] font-semibold" onClick={() => envoyer(false)} disabled={loading}>{t("Renvoyer le code")}</button>
              {" · "}
              <button className="hover:text-[#111]" onClick={() => { setView("identifiant"); setError(""); }}>{t("Changer d'email")}</button>
            </p>
          )}

          <div className="mt-4 text-center">
            <Link href={`/${slug}`} className="text-[12px] text-[#888] hover:text-[#111]">{t("← Retour à la boutique")}</Link>
          </div>
        </div>
      </div>
    );
  }

  // Account dashboard
  return (
    <div className={habille ? "py-10" : "min-h-screen bg-[#FAFAFA]"}>
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#F5A623] flex items-center justify-center">
              <User size={18} className="text-white" />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-[#111]">{t(compte?.nom)}</p>
              <p className="text-[12px] text-[#888]">{compte?.email ?? compte?.telephone}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/${slug}`} className="text-[12px] text-[#888] hover:text-[#111] px-3 py-1.5 rounded-lg border border-[#E5E5E5]">
              {t("Boutique")}
            </Link>
            <button onClick={logout} className="flex items-center gap-1.5 text-[12px] text-[#888] hover:text-red-500 px-3 py-1.5 rounded-lg border border-[#E5E5E5]">
              <LogOut size={12} />{" "}{t("Déconnexion")}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-[#F0F0F0] p-4">
            <p className="text-[11px] text-[#888]">{t("Commandes")}</p>
            <p className="text-2xl font-bold text-[#111]">{commandes.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-[#F0F0F0] p-4">
            <p className="text-[11px] text-[#888]">{t("Total dépensé")}</p>
            <p className="text-2xl font-bold text-[#111]">
              {commandes
                .filter((c) => !["annulee", "remboursee"].includes(c.statut))
                .reduce((s, c) => s + c.montantTotal, 0)
                .toLocaleString()}
            </p>
          </div>
        </div>

        {/* Commandes */}
        <h2 className="text-[14px] font-semibold text-[#111] mb-3">{t("Mes commandes")}</h2>
        {commandes.length === 0 ? (
          <div className="bg-white border border-dashed border-[#E5E5E5] rounded-xl p-10 text-center">
            <Package size={28} className="mx-auto mb-3 text-[#DDD]" />
            <p className="text-[13px] text-[#888]">{t("Aucune commande pour l'instant.")}</p>
            <Link href={`/${slug}`} className="mt-4 inline-block px-4 py-2 rounded-xl text-white text-[13px] font-semibold" style={{ background: "#F5A623" }}>
              {t("Découvrir la boutique")}
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {commandes.map((c) => {
              const sc = STATUT_CONFIG[c.statut] ?? { label: c.statut, color: "#888" };
              return (
                <div key={c.id} className="bg-white border border-[#F0F0F0] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-[13px] font-semibold text-[#111] font-mono">{c.numero}</p>
                      <p className="text-[11px] text-[#888]">{new Date(c.createdAt).toLocaleDateString("fr")}</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold text-white" style={{ background: sc.color }}>{t(sc.label)}</span>
                      <p className="text-[13px] font-bold text-[#111] mt-1">{c.montantTotal.toLocaleString()} {t(c.devise)}</p>
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
                          <p className="text-[12px] text-[#444] truncate">{t(l.nom)}</p>
                          <p className="text-[10px] text-[#888]">x{l.quantite} · {l.prix.toLocaleString()} {t(c.devise)}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {c.accesDigital && (
                    <Link href={`/${slug}/confirmation/${c.id}`}
                      className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-[13px] font-semibold text-white" style={{ background: "#111" }}>
                      <Download size={14} />{" "}{t("Accéder à mon achat")}
                    </Link>
                  )}

                  {/* Footer */}
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#F0F0F0]">
                    {c.facture && (
                      <span className="text-[11px] text-[#888]">{t("Facture")}{" "}{c.facture.numero}</span>
                    )}
                    {c.trackingToken && (
                      <Link href={`/${slug}/tracking/${c.trackingToken}`} className="flex items-center gap-1.5 text-[11px] text-[#F5A623] font-semibold ml-auto">
                        <Eye size={11} />{" "}{t("Suivre")}
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
