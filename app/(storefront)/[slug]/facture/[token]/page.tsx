export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Check, Package, Printer } from "lucide-react";

export default async function FacturePage({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { token } = await params;

  const commande = await prisma.commande.findFirst({
    where: { trackingToken: token },
    include: {
      lignes: true,
      tenant: { select: { nomBoutique: true, logoUrl: true, slug: true, email: true, telephone: true, adresse: true, pays: true, devise: true } },
    },
  });
  if (!commande) notFound();

  const tenant = commande.tenant;
  const date = new Date(commande.createdAt).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
  const total = commande.montantTotal;
  const devise = commande.devise || "XAF";

  function fmt(n: number) {
    return n.toLocaleString("fr-FR") + " " + devise;
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@300;400;500;600&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; background: #F8F7F4; color: #1A1A1A; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .page { max-width: 820px; margin: 40px auto; background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 80px rgba(0,0,0,0.10); }
        @media (max-width: 640px) { .page { margin: 0; border-radius: 0; box-shadow: none; } }
        @media print {
          body { background: white; }
          .page { box-shadow: none; border-radius: 0; margin: 0; max-width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="page">
        {/* Header gradient */}
        <div style={{ background: "linear-gradient(135deg, #1A1A1A 0%, #2D2D2D 50%, #111 100%)", padding: "48px 48px 40px", position: "relative", overflow: "hidden" }}>
          {/* Decorative circles */}
          <div style={{ position:"absolute", top:-60, right:-60, width:200, height:200, borderRadius:"50%", background:"rgba(245,166,35,0.08)" }}/>
          <div style={{ position:"absolute", bottom:-40, left:-20, width:140, height:140, borderRadius:"50%", background:"rgba(245,166,35,0.05)" }}/>

          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", position:"relative", zIndex:1 }}>
            <div>
              {tenant.logoUrl ? (
                <img src={tenant.logoUrl} alt={tenant.nomBoutique} style={{ height:56, objectFit:"contain", marginBottom:16, filter:"brightness(0) invert(1)" }} />
              ) : (
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:28, fontWeight:700, color:"white", marginBottom:16, letterSpacing:"-0.5px" }}>
                  {tenant.nomBoutique}
                </div>
              )}
              <div style={{ color:"rgba(255,255,255,0.45)", fontSize:12, lineHeight:1.8 }}>
                {tenant.adresse && <div>{tenant.adresse}</div>}
                {tenant.pays && <div>{tenant.pays}</div>}
                {tenant.telephone && <div>{tenant.telephone}</div>}
                {tenant.email && <div>{tenant.email}</div>}
              </div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ color:"rgba(245,166,35,0.7)", fontSize:11, fontWeight:600, letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:8 }}>Facture</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:36, fontWeight:700, color:"white", letterSpacing:"-1px" }}>#{commande.numero}</div>
              <div style={{ color:"rgba(255,255,255,0.4)", fontSize:12, marginTop:8 }}>{date}</div>
              <div style={{ marginTop:16, display:"inline-block", background:"rgba(245,166,35,0.15)", border:"1px solid rgba(245,166,35,0.3)", borderRadius:100, padding:"6px 16px" }}>
                <span style={{ color:"#F5A623", fontSize:11, fontWeight:600, display:"inline-flex", alignItems:"center", gap:4 }}>
                  {commande.paiementStatut === "completed" ? <><Check size={10} /> Payée</> : "En attente"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Gold divider */}
        <div style={{ height:3, background:"linear-gradient(90deg, #F5A623, #e09520, #F5A623)" }} />

        {/* Client info */}
        <div style={{ padding:"36px 48px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:32, background:"#FAFAF8" }}>
          <div>
            <div style={{ fontSize:10, fontWeight:700, color:"#999", letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:12 }}>Facturé à</div>
            <div style={{ fontSize:17, fontWeight:600, color:"#1A1A1A", marginBottom:4 }}>{commande.clientNom}</div>
            {commande.clientEmail && <div style={{ fontSize:13, color:"#666", marginBottom:2 }}>{commande.clientEmail}</div>}
            {commande.clientTelephone && <div style={{ fontSize:13, color:"#666", marginBottom:2 }}>{commande.clientTelephone}</div>}
            {(commande.adresseExacte || commande.adresseLivraison) && (
              <div style={{ fontSize:13, color:"#666", marginTop:4 }}>{commande.adresseExacte || commande.adresseLivraison}</div>
            )}
            {commande.ville && <div style={{ fontSize:13, color:"#666" }}>{commande.ville}{commande.pays ? `, ${commande.pays}` : ""}</div>}
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:10, fontWeight:700, color:"#999", letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:12 }}>Détails</div>
            <div style={{ fontSize:13, color:"#666", marginBottom:4 }}>Date : <strong style={{ color:"#1A1A1A" }}>{date}</strong></div>
            <div style={{ fontSize:13, color:"#666", marginBottom:4 }}>Commande : <strong style={{ color:"#1A1A1A" }}>#{commande.numero}</strong></div>
            <div style={{ fontSize:13, color:"#666" }}>Paiement : <strong style={{ color:"#1A1A1A" }}>{commande.methodePaiement === "notchpay" ? "En ligne (NotchPay)" : "À la livraison"}</strong></div>
          </div>
        </div>

        {/* Items table */}
        <div style={{ padding:"0 48px 36px" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ borderBottom:"2px solid #F0EDE8" }}>
                <th style={{ textAlign:"left", padding:"12px 0", fontSize:10, fontWeight:700, color:"#999", letterSpacing:"0.12em", textTransform:"uppercase", width:"50%" }}>Produit</th>
                <th style={{ textAlign:"center", padding:"12px 0", fontSize:10, fontWeight:700, color:"#999", letterSpacing:"0.12em", textTransform:"uppercase" }}>Qté</th>
                <th style={{ textAlign:"right", padding:"12px 0", fontSize:10, fontWeight:700, color:"#999", letterSpacing:"0.12em", textTransform:"uppercase" }}>P.U.</th>
                <th style={{ textAlign:"right", padding:"12px 0", fontSize:10, fontWeight:700, color:"#999", letterSpacing:"0.12em", textTransform:"uppercase" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {commande.lignes.map((l: any, i: number) => (
                <tr key={l.id} style={{ borderBottom:"1px solid #F5F4F1" }}>
                  <td style={{ padding:"16px 0", verticalAlign:"middle" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                      {l.imageUrl ? (
                        <img src={l.imageUrl} alt={l.nom} style={{ width:44, height:44, borderRadius:10, objectFit:"cover", flexShrink:0 }} />
                      ) : (
                        <div style={{ width:44, height:44, borderRadius:10, background:"#F5F4F1", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, color:"#9CA3AF" }}><Package size={20} /></div>
                      )}
                      <div>
                        <div style={{ fontSize:14, fontWeight:500, color:"#1A1A1A" }}>{l.nom}</div>
                        {l.variante && <div style={{ fontSize:11, color:"#999", marginTop:2 }}>{l.variante}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ textAlign:"center", fontSize:14, color:"#555", padding:"16px 8px" }}>{l.quantite}</td>
                  <td style={{ textAlign:"right", fontSize:14, color:"#555", padding:"16px 0 16px 8px" }}>{fmt(l.prix)}</td>
                  <td style={{ textAlign:"right", fontSize:14, fontWeight:600, color:"#1A1A1A", padding:"16px 0 16px 8px" }}>{fmt(l.prix * l.quantite)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ marginTop:24, display:"flex", justifyContent:"flex-end" }}>
            <div style={{ width:280 }}>
              {commande.montantLivraison > 0 && (
                <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", fontSize:13, color:"#666", borderBottom:"1px solid #F0EDE8" }}>
                  <span>Sous-total</span><span>{fmt(commande.montantSousTotal)}</span>
                </div>
              )}
              {commande.montantLivraison > 0 && (
                <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", fontSize:13, color:"#666", borderBottom:"1px solid #F0EDE8" }}>
                  <span>Livraison</span><span>{fmt(commande.montantLivraison)}</span>
                </div>
              )}
              {commande.montantReduction > 0 && (
                <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", fontSize:13, color:"#22c55e", borderBottom:"1px solid #F0EDE8" }}>
                  <span>Réduction</span><span>−{fmt(commande.montantReduction)}</span>
                </div>
              )}
              <div style={{ display:"flex", justifyContent:"space-between", padding:"16px 20px", marginTop:8, background:"linear-gradient(135deg, #1A1A1A, #2D2D2D)", borderRadius:14 }}>
                <span style={{ fontSize:14, fontWeight:600, color:"rgba(255,255,255,0.7)" }}>Total à payer</span>
                <span style={{ fontSize:20, fontWeight:700, color:"#F5A623", fontFamily:"'Playfair Display',serif" }}>{fmt(total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:"28px 48px", background:"#F8F7F4", borderTop:"1px solid #EDEAE4", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize:11, color:"#999", marginBottom:4 }}>Généré par</div>
            <div style={{ fontSize:13, fontWeight:600, color:"#1A1A1A" }}>{tenant.nomBoutique}</div>
          </div>
          <div style={{ textAlign:"center" }}>
            <div style={{ width:32, height:2, background:"#F5A623", margin:"0 auto 8px", borderRadius:4 }} />
            <div style={{ fontSize:10, color:"#BBB", letterSpacing:"0.1em" }}>MERCI POUR VOTRE CONFIANCE</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:11, color:"#999", marginBottom:4 }}>Powered by</div>
            <div style={{ fontSize:13, fontWeight:700, color:"#F5A623" }}>Axso</div>
          </div>
        </div>
      </div>

      {/* Print button — Server Component : pas de onClick React, on attache
          l'écouteur en JS pur via ce script (évite l'erreur "Event handlers
          cannot be passed to Client Component props"). */}
      <div className="no-print" style={{ textAlign:"center", padding:"24px", position:"sticky", bottom:0, background:"rgba(248,247,244,0.9)", backdropFilter:"blur(8px)" }}>
        <button id="ax-btn-print"
          style={{ background:"linear-gradient(135deg,#1A1A1A,#333)", color:"white", border:"none", padding:"14px 36px", borderRadius:100, fontSize:14, fontWeight:600, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:8, boxShadow:"0 4px 20px rgba(0,0,0,0.2)" }}>
          <Printer size={16} /> Télécharger / Imprimer la facture
        </button>
      </div>
      <script dangerouslySetInnerHTML={{ __html: `
        document.getElementById('ax-btn-print')?.addEventListener('click', () => window.print());
      `}} />
    </>
  );
}
