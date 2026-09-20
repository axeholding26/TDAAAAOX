"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  Copy, Check, TrendingUp, MousePointerClick, Wallet,
  MessageCircle, Camera, Mail, Award, Clock, CheckCircle2, XCircle, Sparkles,
} from "lucide-react";
import { ClicsConversionsChart, CommissionsChart } from "@/components/affilie/AffiliationCharts";

const PERIODES = [7, 30, 90] as const;

function descriptionCommission(programme: any): string {
  if (!programme) return "";
  if (programme.typeCommission === "fixe") {
    return `${programme.valeurCommission.toLocaleString("fr-FR")} par conversion.`;
  }
  return `${programme.valeurCommission}% sur chaque vente que tu apportes.`;
}

export default function PortailAffiliePage() {
  const params = useParams<{ token: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copie, setCopie] = useState<string | null>(null);
  const [periode, setPeriode] = useState<7 | 30 | 90>(30);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/affilie/${params.token}?periode=${periode}`)
      .then((r) => r.json())
      .then((d) => { if (!d.error) setData(d); })
      .finally(() => setLoading(false));
  }, [params.token, periode]);

  function copier(texte: string, id: string) {
    navigator.clipboard.writeText(texte).then(() => {
      setCopie(id);
      toast.success("Copié !");
      setTimeout(() => setCopie(null), 2000);
    });
  }

  if (loading && !data) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FAFAFA" }}>
        <div style={{ width: 32, height: 32, border: "3px solid #F5A623", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FAFAFA", fontFamily: "system-ui,sans-serif" }}>
        <p style={{ color: "#888" }}>Portail introuvable.</p>
      </div>
    );
  }

  const { affilie, programme, palier, tenant, commissions, paiements, produits, periode: p } = data;
  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const lienPartage = `${appUrl}/${tenant.slug}?ref=${affilie.codeParrainage}`;

  const textes = [
    { id: "whatsapp", label: "WhatsApp", Icon: MessageCircle, couleur: "#25D366",
      texte: `🛍️ Je te recommande *${tenant.nomBoutique}* ! Des produits top qualité. Commande ici : ${lienPartage}` },
    { id: "instagram", label: "Instagram / Facebook", Icon: Camera, couleur: "#E1306C",
      texte: `✨ Découvrez ${tenant.nomBoutique} ! Des produits de qualité livrés rapidement. Lien en bio → ${lienPartage}` },
    { id: "email", label: "Email", Icon: Mail, couleur: "#6b7280",
      texte: `Bonjour,\n\nJe voulais vous partager une boutique que j'aime beaucoup : ${tenant.nomBoutique}.\nDécouvrez leurs produits ici :\n${lienPartage}\n\nBonne découverte !` },
  ];

  const STATUT_BADGE: Record<string, { label: string; color: string }> = {
    pending: { label: "En attente", color: "#F5A623" },
    approuvee: { label: "Approuvée", color: "#3b82f6" },
    payee: { label: "Payée", color: "#10b981" },
    rejetee: { label: "Rejetée", color: "#ef4444" },
  };

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAFA", fontFamily: "'Poppins',system-ui,sans-serif" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#111111,#0a0a0a)", padding: "32px 20px 60px", color: "white" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            {tenant.logoUrl && <img src={tenant.logoUrl} alt="" style={{ height: 28, borderRadius: 6 }} />}
            <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.6, letterSpacing: "0.08em", textTransform: "uppercase" }}>{tenant.nomBoutique}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Sparkles size={18} color="#F5A623" />
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Programme d'affiliation</h1>
          </div>
          <p style={{ fontSize: 13.5, opacity: 0.7, marginBottom: 24 }}>
            Partage ton lien : {descriptionCommission(programme)} {affilie.statut !== "actif" && "— ton compte est en attente de validation."}
          </p>

          {/* Lien de parrainage — carte premium */}
          <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: 18, backdropFilter: "blur(8px)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontSize: 11.5, opacity: 0.6 }}>
                Ton lien de parrainage (tracké — cookie {programme?.dureeCookie ?? 30} jours)
              </span>
              <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.04em", color: "#F5A623", background: "rgba(245,166,35,0.15)", border: "1px solid rgba(245,166,35,0.3)", borderRadius: 99, padding: "4px 10px" }}>
                CODE {affilie.codeParrainage}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,0.25)", borderRadius: 14, padding: "10px 14px", flexWrap: "wrap" }}>
              <span style={{ flex: 1, minWidth: 180, fontSize: 13, fontFamily: "monospace", color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lienPartage}</span>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => copier(lienPartage, "lien")} style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 10, padding: "8px 14px", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: "white", fontSize: 12, fontWeight: 700 }}>
                  {copie === "lien" ? <Check size={13} /> : <Copy size={13} />} Copier
                </button>
                <a href={`https://wa.me/?text=${encodeURIComponent(textes[0].texte)}`} target="_blank" rel="noopener noreferrer"
                  style={{ background: "#25D366", border: "none", borderRadius: 10, padding: "8px 14px", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: "white", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
                  <MessageCircle size={13} /> WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "-32px auto 0", padding: "0 20px 60px" }}>

        {/* Sélecteur de période */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <p style={{ fontSize: 12.5, fontWeight: 700, color: "#111" }}>Performance des {periode} derniers jours</p>
          <div style={{ display: "flex", background: "white", borderRadius: 12, padding: 4, boxShadow: "0 2px 10px rgba(0,0,0,0.06)" }}>
            {PERIODES.map(pv => (
              <button key={pv} onClick={() => setPeriode(pv)}
                style={{
                  padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                  fontSize: 11.5, fontWeight: 700,
                  background: periode === pv ? "#111111" : "transparent",
                  color: periode === pv ? "white" : "#9ca3af",
                }}>
                {pv} j
              </button>
            ))}
          </div>
        </div>

        {/* Stats période */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, marginBottom: 16 }}>
          {[
            { label: "Solde disponible", value: `${(p?.soldeDisponible ?? 0).toLocaleString("fr-FR")} ${tenant.devise}`, sub: p?.seuilPaiement ? `Retrait dès ${p.seuilPaiement.toLocaleString("fr-FR")} ${tenant.devise}` : undefined, Icon: Wallet, color: "#F5A623" },
            { label: "Commissions période", value: `${(p?.commissionsPeriode ?? 0).toLocaleString("fr-FR")} ${tenant.devise}`, Icon: TrendingUp, color: "#10b981" },
            { label: "Conversions période", value: p?.conversionsPeriode ?? 0, sub: `${p?.clicsPeriode ?? 0} clics`, Icon: MousePointerClick, color: "#3b82f6" },
            { label: "Commissions payées", value: `${(p?.commissionsPayeesPeriode ?? 0).toLocaleString("fr-FR")} ${tenant.devise}`, Icon: CheckCircle2, color: "#8b5cf6" },
          ].map((s) => (
            <div key={s.label} style={{ background: "white", borderRadius: 16, padding: 16, boxShadow: "0 4px 16px rgba(0,0,0,0.04)" }}>
              <s.Icon size={14} style={{ color: s.color, marginBottom: 6 }} />
              <p style={{ fontSize: 18, fontWeight: 800, color: "#111" }}>{s.value}</p>
              <p style={{ fontSize: 10.5, color: "#999" }}>{s.label}</p>
              {s.sub && <p style={{ fontSize: 9.5, color: "#C0C0C0", marginTop: 2 }}>{s.sub}</p>}
            </div>
          ))}
        </div>

        {/* Graphiques */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 }}>
          <ClicsConversionsChart donnees={p?.seriesJour ?? []} />
          <CommissionsChart donnees={p?.seriesJour ?? []} devise={tenant.devise} />
        </div>

        {/* Palier / progression */}
        {palier && palier.prochainPalier && (
          <div style={{ background: "white", borderRadius: 20, padding: 20, marginBottom: 16, boxShadow: "0 4px 16px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <p style={{ fontSize: 12.5, fontWeight: 700, color: "#111" }}><Award size={12} style={{ display: "inline", marginRight: 4, color: "#F5A623" }} />Palier {palier.nom} — {palier.tauxActuel}%</p>
              <p style={{ fontSize: 11, color: "#888" }}>{palier.conversionsRestantes} vente{palier.conversionsRestantes! > 1 ? "s" : ""} avant {palier.prochainPalier}</p>
            </div>
            <div style={{ height: 8, background: "#F0F0F0", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(100, (affilie.conversions / (affilie.conversions + palier.conversionsRestantes)) * 100)}%`, background: "linear-gradient(90deg,#F5A623,#FFD280)", borderRadius: 99 }} />
            </div>
          </div>
        )}

        {/* Liens par produit */}
        {produits && produits.length > 0 && (
          <div style={{ background: "white", borderRadius: 20, padding: 20, marginBottom: 16, boxShadow: "0 4px 16px rgba(0,0,0,0.04)" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
              Liens par produit
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {produits.map((prod: any) => {
                const lienProduit = `${appUrl}/${tenant.slug}/produits/${prod.id}?ref=${affilie.codeParrainage}`;
                const idCopie = `produit-${prod.id}`;
                return (
                  <div key={prod.id} style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid #F0F0F0", borderRadius: 14, padding: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "#FAFAFA", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {prod.image ? <img src={prod.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 16 }}>📦</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12.5, fontWeight: 600, color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{prod.nom}</p>
                      <p style={{ fontSize: 11, color: "#10b981", fontWeight: 700 }}>Commission {prod.tauxCommissionPct}%</p>
                    </div>
                    <button onClick={() => copier(lienProduit, idCopie)} style={{ flexShrink: 0, background: "#F5A623", border: "none", borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                      {copie === idCopie ? <Check size={13} color="white" /> : <Copy size={13} color="white" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Textes prêts à partager */}
        <div style={{ background: "white", borderRadius: 20, padding: 20, marginBottom: 16, boxShadow: "0 4px 16px rgba(0,0,0,0.04)" }}>
          <p style={{ fontSize: 12.5, fontWeight: 700, color: "#111", marginBottom: 14 }}>Textes prêts à partager</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {textes.map((t) => (
              <div key={t.id} style={{ border: "1px solid #F0F0F0", borderRadius: 14, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <t.Icon size={13} style={{ color: t.couleur }} />
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "#111" }}>{t.label}</span>
                  </div>
                  <button onClick={() => copier(t.texte, t.id)} style={{ background: "#FAFAFA", border: "1px solid #F0F0F0", borderRadius: 8, padding: "4px 10px", fontSize: 10.5, fontWeight: 700, color: "#666", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                    {copie === t.id ? <Check size={11} /> : <Copy size={11} />} Copier
                  </button>
                </div>
                <p style={{ fontSize: 11.5, color: "#666", whiteSpace: "pre-line", lineHeight: 1.5 }}>{t.texte}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Commissions récentes */}
        <div style={{ background: "white", borderRadius: 20, padding: 20, marginBottom: 16, boxShadow: "0 4px 16px rgba(0,0,0,0.04)" }}>
          <p style={{ fontSize: 12.5, fontWeight: 700, color: "#111", marginBottom: 12 }}>Commissions récentes</p>
          {commissions.length === 0 ? (
            <p style={{ fontSize: 12, color: "#999", textAlign: "center", padding: "16px 0" }}>Aucune commission pour le moment — partagez votre lien pour commencer !</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {commissions.map((c: any) => {
                const b = STATUT_BADGE[c.statut] ?? { label: c.statut, color: "#888" };
                return (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #F8F8F8" }}>
                    <div>
                      <p style={{ fontSize: 12, color: "#111", fontWeight: 600 }}>{c.montantCommission.toLocaleString()} {tenant.devise}</p>
                      <p style={{ fontSize: 10.5, color: "#AAA" }}>{new Date(c.createdAt).toLocaleDateString("fr-FR")}</p>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 99, color: b.color, background: `${b.color}15` }}>{b.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Historique paiements */}
        {paiements.length > 0 && (
          <div style={{ background: "white", borderRadius: 20, padding: 20, boxShadow: "0 4px 16px rgba(0,0,0,0.04)" }}>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: "#111", marginBottom: 12 }}>Historique de paiement</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {paiements.map((pay: any) => (
                <div key={pay.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #F8F8F8" }}>
                  {pay.statut === "traite" ? <CheckCircle2 size={14} color="#10b981" /> : pay.statut === "echec" ? <XCircle size={14} color="#ef4444" /> : <Clock size={14} color="#F5A623" />}
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12, color: "#111", fontWeight: 600 }}>{pay.montant.toLocaleString()} {tenant.devise}</p>
                    <p style={{ fontSize: 10.5, color: "#AAA" }}>{new Date(pay.createdAt).toLocaleDateString("fr-FR")}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p style={{ textAlign: "center", fontSize: 11, color: "#BBB", marginTop: 24 }}>
          Propulsé par <span style={{ color: "#F5A623", fontWeight: 700 }}>Axso</span>
        </p>
      </div>
    </div>
  );
}
