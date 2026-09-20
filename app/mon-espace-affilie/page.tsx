"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Users, Eye, ShoppingBag, Wallet, ExternalLink, X, Plus,
  TrendingUp, ArrowRight, Loader2, Inbox,
} from "lucide-react";
import { NavbarMarketing } from "@/components/marketing/NavbarMarketing";
import { FooterMarketing } from "@/components/marketing/FooterMarketing";
import { ClicsConversionsChart, CommissionsChart } from "@/components/affilie/AffiliationCharts";
import {
  listerAffiliationsLocales, retirerAffiliationLocale, enregistrerAffiliationLocale,
  extraireTokenPortail, type AffiliationLocale,
} from "@/lib/affiliation-local";

interface Jour { date: string; clics: number; conversions: number; commissions: number; }

interface Compte {
  entry: AffiliationLocale;
  loading: boolean;
  erreur: boolean;
  data?: {
    affilie: { nom: string; clics: number; conversions: number; commissionTotal: number; commissionPending: number; statut: string };
    tenant: { nomBoutique: string; slug: string; logoUrl: string | null; devise: string };
    programme?: { nom: string } | null;
    periode: { seriesJour: Jour[] };
  };
}

const PERIODES = [7, 30, 90] as const;
const inp = "w-full px-4 py-3 text-sm rounded-xl border outline-none";
const inpStyle = { borderColor: "rgba(0,0,0,0.1)" };

export default function MonEspaceAffiliePage() {
  const [comptes, setComptes] = useState<Compte[]>([]);
  const [chargementInitial, setChargementInitial] = useState(true);
  const [periode, setPeriode] = useState<7 | 30 | 90>(30);
  const [nouveauLien, setNouveauLien] = useState("");
  const [ajoutErreur, setAjoutErreur] = useState("");

  async function chargerCompte(entry: AffiliationLocale, p: number): Promise<Compte> {
    try {
      const res = await fetch(`/api/affilie/${entry.portalToken}?periode=${p}`);
      if (!res.ok) return { entry, loading: false, erreur: true };
      const data = await res.json();
      return { entry, loading: false, erreur: false, data };
    } catch {
      return { entry, loading: false, erreur: true };
    }
  }

  async function chargerTout(p: number) {
    const entries = listerAffiliationsLocales();
    if (entries.length === 0) { setComptes([]); setChargementInitial(false); return; }
    setComptes(entries.map((entry) => ({ entry, loading: true, erreur: false })));
    const resultats = await Promise.all(entries.map((e) => chargerCompte(e, p)));
    setComptes(resultats);
    setChargementInitial(false);
  }

  useEffect(() => { chargerTout(periode); }, [periode]);

  async function ajouterLien(e: React.FormEvent) {
    e.preventDefault();
    setAjoutErreur("");
    const token = extraireTokenPortail(nouveauLien);
    if (!token) { setAjoutErreur("Lien ou code invalide."); return; }
    const res = await fetch(`/api/affilie/${token}`);
    if (!res.ok) { setAjoutErreur("Aucun compte affilié trouvé avec ce lien."); return; }
    const data = await res.json();
    enregistrerAffiliationLocale({
      portalToken: token,
      nomBoutique: data.tenant.nomBoutique,
      logoUrl: data.tenant.logoUrl,
      nomProgramme: data.programme?.nom ?? "Programme affilié",
    });
    setNouveauLien("");
    toast.success("Compte ajouté !");
    chargerTout(periode);
  }

  function retirer(token: string) {
    retirerAffiliationLocale(token);
    setComptes((c) => c.filter((x) => x.entry.portalToken !== token));
  }

  const comptesValides = comptes.filter((c) => c.data);

  const totaux = comptesValides.reduce(
    (acc, c) => ({
      clics: acc.clics + (c.data?.affilie.clics ?? 0),
      conversions: acc.conversions + (c.data?.affilie.conversions ?? 0),
      commissionTotal: acc.commissionTotal + (c.data?.affilie.commissionTotal ?? 0),
      commissionPending: acc.commissionPending + (c.data?.affilie.commissionPending ?? 0),
    }),
    { clics: 0, conversions: 0, commissionTotal: 0, commissionPending: 0 }
  );

  // Clics/conversions se cumulent sans souci de devise. Les commissions, elles,
  // sont regroupées par devise pour ne jamais additionner des monnaies différentes.
  const seriesClicsConv = useMemo<Jour[]>(() => {
    if (comptesValides.length === 0) return [];
    const longueur = Math.max(...comptesValides.map((c) => c.data!.periode.seriesJour.length));
    return Array.from({ length: longueur }, (_, i) => {
      let clics = 0, conversions = 0, date = "";
      for (const c of comptesValides) {
        const j = c.data!.periode.seriesJour[i];
        if (j) { clics += j.clics; conversions += j.conversions; date = j.date; }
      }
      return { date, clics, conversions, commissions: 0 };
    });
  }, [comptesValides]);

  const commissionsParDevise = useMemo(() => {
    const groupes: Record<string, Jour[]> = {};
    for (const c of comptesValides) {
      const devise = c.data!.tenant.devise;
      const serie = c.data!.periode.seriesJour;
      if (!groupes[devise]) groupes[devise] = serie.map((j) => ({ ...j, clics: 0, conversions: 0, commissions: 0 }));
      groupes[devise] = groupes[devise].map((acc, i) => ({
        date: serie[i]?.date ?? acc.date,
        clics: 0, conversions: 0,
        commissions: acc.commissions + (serie[i]?.commissions ?? 0),
      }));
    }
    return groupes;
  }, [comptesValides]);

  return (
    <main className="bg-white text-[#111111] min-h-screen" style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <NavbarMarketing />

      <section className="pt-32 pb-6 px-6 sm:px-10 lg:px-16 xl:px-24">
        <div className="max-w-4xl mx-auto flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black mb-2">Mon espace affilié</h1>
            <p className="text-[#808080]">Vue agrégée de tous les marchands que vous promouvez sur AXSO.</p>
          </div>
          {comptes.length > 0 && (
            <div className="flex bg-gray-100 rounded-xl p-1">
              {PERIODES.map((pv) => (
                <button key={pv} onClick={() => setPeriode(pv)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${periode === pv ? "bg-white shadow-sm text-[#111]" : "text-gray-400"}`}>
                  {pv}j
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="px-6 sm:px-10 lg:px-16 xl:px-24 pb-8">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={ajouterLien} className="rounded-2xl p-4 border flex flex-wrap gap-2 items-start"
            style={{ borderColor: "rgba(0,0,0,0.08)", background: "rgba(0,0,0,0.015)" }}>
            <div className="flex-1 min-w-56">
              <input
                value={nouveauLien}
                onChange={(e) => setNouveauLien(e.target.value)}
                placeholder="Coller un lien de portail (ex: https://axso.vercel.app/affilie/xxxx)"
                className={inp} style={inpStyle}
              />
              {ajoutErreur && <p className="text-xs text-red-500 mt-1.5">{ajoutErreur}</p>}
            </div>
            <button type="submit" className="px-5 py-3 rounded-xl text-sm font-bold text-white flex items-center gap-2" style={{ background: "#111111" }}>
              <Plus size={14} /> Ajouter
            </button>
          </form>
        </div>
      </section>

      {chargementInitial ? (
        <div className="py-20 text-center">
          <Loader2 size={24} className="animate-spin mx-auto" style={{ color: "#F5A623" }} />
        </div>
      ) : comptes.length === 0 ? (
        <section className="px-6 sm:px-10 lg:px-16 xl:px-24 pb-28">
          <div className="max-w-4xl mx-auto text-center py-20 rounded-3xl border-2 border-dashed" style={{ borderColor: "rgba(0,0,0,0.1)" }}>
            <Inbox size={40} className="mx-auto mb-4" style={{ color: "#D9D9D9" }} />
            <p className="font-bold text-[#111111] mb-2">Aucune affiliation pour l'instant</p>
            <p className="text-sm text-[#999999] max-w-sm mx-auto mb-6">
              Rejoignez un programme depuis le marketplace, ou collez ci-dessus le lien de portail que vous avez reçu par email.
            </p>
            <Link href="/affiliation" className="inline-flex items-center gap-2 font-bold px-6 py-3 rounded-xl"
              style={{ background: "#F5A623", color: "#080808" }}>
              Parcourir le marketplace <ArrowRight size={15} />
            </Link>
          </div>
        </section>
      ) : (
        <>
          {/* Totaux agrégés */}
          <section className="px-6 sm:px-10 lg:px-16 xl:px-24 pb-8">
            <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { Icon: Eye, n: totaux.clics.toLocaleString(), label: "clics" },
                { Icon: ShoppingBag, n: totaux.conversions.toLocaleString(), label: "ventes" },
                { Icon: Wallet, n: `${totaux.commissionTotal.toLocaleString()}`, label: "gagné (toutes devises)" },
                { Icon: TrendingUp, n: `${totaux.commissionPending.toLocaleString()}`, label: "en attente" },
              ].map(({ Icon, n, label }) => (
                <div key={label} className="rounded-2xl p-4 text-center border" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
                  <Icon size={16} className="mx-auto mb-2" style={{ color: "#F5A623" }} />
                  <p className="text-xl font-black">{n}</p>
                  <p className="text-[10px] text-[#999999] mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Graphiques combinés */}
          <section className="px-6 sm:px-10 lg:px-16 xl:px-24 pb-8">
            <div className="max-w-4xl mx-auto space-y-4">
              <ClicsConversionsChart donnees={seriesClicsConv} />
              {Object.entries(commissionsParDevise).map(([devise, serie]) => (
                <CommissionsChart key={devise} donnees={serie} devise={devise} />
              ))}
              {Object.keys(commissionsParDevise).length > 1 && (
                <p className="text-[11px] text-[#AAAAAA] text-center">
                  Un graphique par devise — les commissions ne sont jamais additionnées entre monnaies différentes.
                </p>
              )}
            </div>
          </section>

          {/* Liste des comptes */}
          <section className="px-6 sm:px-10 lg:px-16 xl:px-24 pb-28">
            <div className="max-w-4xl mx-auto space-y-3">
              <p className="text-sm font-bold text-[#111111] mb-1">Détail par marchand</p>
              {comptes.map((c) => (
                <div key={c.entry.portalToken} className="rounded-2xl border p-4 flex items-center gap-3" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
                  {c.entry.logoUrl ? (
                    <img src={c.entry.logoUrl} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(245,166,35,0.1)" }}>
                      <Users size={16} style={{ color: "#F5A623" }} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{c.entry.nomBoutique}</p>
                    {c.loading ? (
                      <p className="text-xs text-[#AAAAAA]">Chargement…</p>
                    ) : c.erreur ? (
                      <p className="text-xs text-red-400">Compte introuvable — a peut-être été supprimé</p>
                    ) : (
                      <p className="text-xs text-[#999999]">
                        {c.data!.affilie.clics} clics · {c.data!.affilie.conversions} ventes · <span className="font-bold" style={{ color: "#F5A623" }}>{c.data!.affilie.commissionTotal.toLocaleString()} {c.data!.tenant.devise}</span>
                      </p>
                    )}
                  </div>
                  {!c.loading && !c.erreur && (
                    <a href={`/affilie/${c.entry.portalToken}`} target="_blank" rel="noreferrer"
                      className="flex-shrink-0 p-2 rounded-xl transition-colors hover:bg-gray-50" style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
                      <ExternalLink size={14} style={{ color: "#666666" }} />
                    </a>
                  )}
                  <button onClick={() => retirer(c.entry.portalToken)} className="flex-shrink-0 p-2 rounded-xl transition-colors hover:bg-gray-50" style={{ border: "1px solid rgba(0,0,0,0.08)" }} aria-label="Retirer">
                    <X size={14} style={{ color: "#CCCCCC" }} />
                  </button>
                </div>
              ))}
              <Link href="/affiliation" className="flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-dashed text-sm font-semibold transition-colors hover:bg-gray-50"
                style={{ borderColor: "rgba(0,0,0,0.1)", color: "#666666" }}>
                <Plus size={14} /> Trouver de nouveaux produits à promouvoir
              </Link>
            </div>
          </section>
        </>
      )}

      <FooterMarketing />
    </main>
  );
}
