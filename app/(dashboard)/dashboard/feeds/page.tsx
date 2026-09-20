"use client";
import { useEffect, useState } from "react";
import { Copy, Check, ExternalLink, Package, RefreshCw, Info, Zap, Search, Globe, Music4, CheckCircle, ClipboardList, Gift } from "lucide-react";
import { toast } from "sonner";
import { ModuleTutorial, BoutonRevoirTutoriel } from "@/components/dashboard/ModuleTutorial";

const FEEDS_TUTORIAL_STEPS = [
  { Icon: Search,       titre: "Google Shopping gratuit", description: "Soumettez votre flux XML dans Google Merchant Center pour apparaître gratuitement dans Google Shopping et Google Images." },
  { Icon: Globe,        titre: "Meta & TikTok Catalog",     description: "Un flux CSV pour chaque plateforme, à coller dans Meta Business Suite ou TikTok for Business pour lancer des Dynamic Ads." },
  { Icon: Copy,         titre: "Copiez l'URL du flux",       description: "Chaque plateforme a sa propre URL, générée automatiquement à partir de votre catalogue. Copiez-collez, c'est tout." },
];

const PLATEFORMES_FEED = [
  {
    id: "google",
    nom: "Google Shopping",
    Icon: Search,
    color: "#4285F4",
    format: "XML (RSS 2.0)",
    path: "/api/feed/google",
    description: "Listings GRATUITS dans Google Shopping + Google Search",
    avantages: ["Gratuit sans payer de pubs", "Apparaît dans Google Images", "Google Shopping gratuit depuis 2020"],
    etapes: [
      "Ouvre Google Merchant Center : merchants.google.com",
      "Crée un compte marchand avec ton email",
      "Va dans Produits → Flux de données",
      "Ajoute un flux → Type : URL planifiée → Colle l'URL ci-dessous",
      "Google indexe tes produits en 24-72h",
    ],
    badge: "Gratuit",
    badgeColor: "#34d399",
  },
  {
    id: "meta",
    nom: "Meta Catalog",
    Icon: Globe,
    color: "#1877F2",
    format: "CSV",
    path: "/api/feed/meta",
    description: "Catalogue produits pour Facebook & Instagram Dynamic Ads",
    avantages: ["Dynamic Ads automatiques", "Retargeting produit précis", "Instagram Shopping"],
    etapes: [
      "Va dans Meta Business Suite → Commerce Manager",
      "Crée un catalogue → Source de données → URL planifiée",
      "Colle l'URL CSV ci-dessous",
      "Synchronisation automatique toutes les 24h",
    ],
    badge: "Payant",
    badgeColor: "#F5A623",
  },
  {
    id: "tiktok",
    nom: "TikTok Shop",
    Icon: Music4,
    color: "#010101",
    format: "CSV",
    path: "/api/feed/tiktok",
    description: "Catalogue pour TikTok Ads & TikTok Shop",
    avantages: ["Viral product videos", "TikTok Shopping", "Jeune audience africaine"],
    etapes: [
      "Va dans TikTok for Business : ads.tiktok.com",
      "Assets → Catalogue → Créer un catalogue",
      "Source de données → URL → Colle l'URL ci-dessous",
      "Mapping des colonnes → Sauvegarde",
    ],
    badge: "Payant",
    badgeColor: "#F5A623",
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copier() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("URL copiée !");
  }
  return (
    <button onClick={copier}
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-600 text-xs font-medium hover:bg-gray-50 transition-all flex-shrink-0">
      {copied ? <><Check size={12} className="text-green-500" /> Copiée</> : <><Copy size={12} /> Copier</>}
    </button>
  );
}

export default function FeedsPage() {
  const [slug, setSlug] = useState("");
  const [nbProduits, setNbProduits] = useState(0);
  const appUrl = typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL || "";

  useEffect(() => {
    fetch("/api/tenants/moi").then(r => r.json()).then(d => {
      if (d.tenant) {
        setSlug(d.tenant.slug);
        setNbProduits(d.tenant._count?.produits || 0);
      }
    }).catch(() => {});
  }, []);

  return (
    <div className="space-y-6 max-w-4xl">
      <ModuleTutorial moduleKey="feeds" titre="Flux produits" sousTitre="Diffuse ton catalogue ailleurs" steps={FEEDS_TUTORIAL_STEPS} />
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
          <Package size={22} className="text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 font-poppins">Flux Produits (Feeds)</h1>
            <BoutonRevoirTutoriel moduleKey="feeds" />
          </div>
          <p className="text-gray-400 text-sm">Synchronisez votre catalogue sur Google, Meta et TikTok automatiquement</p>
        </div>
      </div>

      {/* Comment Shopify fait */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <Info size={18} className="text-indigo-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-indigo-800">Comment Shopify fait ses Ads</p>
            <p className="text-sm text-indigo-700 mt-1 leading-relaxed">
              Shopify ne lance pas les pubs lui-même. Il génère des <strong>flux produits XML/CSV</strong> que Google, Meta et TikTok consomment automatiquement.
              Les plateformes créent ensuite des <strong>Dynamic Ads</strong> — elles montrent automatiquement le bon produit à la bonne personne en retargeting.
              <br /><strong>AXSO fait exactement la même chose.</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Stat produits */}
      {slug && (
        <div className="flex items-center gap-4 bg-white border border-gray-100 rounded-2xl p-4">
          <div className="w-10 h-10 rounded-xl bg-[#F5A623]/10 flex items-center justify-center">
            <Package size={18} className="text-[#F5A623]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">{nbProduits} produits dans votre catalogue</p>
            <p className="text-xs text-gray-400">Boutique : <strong>{slug}</strong> · Tous synchronisés dans les feeds ci-dessous</p>
          </div>
          <a href={`/api/feed/google?slug=${slug}`} target="_blank" rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1.5 text-xs text-[#F5A623] bg-[#F5A623]/10 px-3 py-1.5 rounded-lg border border-[#F5A623]/20 hover:bg-[#F5A623]/20 transition-all">
            <RefreshCw size={11} /> Tester le feed
          </a>
        </div>
      )}

      {/* Cards plateformes */}
      <div className="space-y-5">
        {PLATEFORMES_FEED.map((plat) => {
          const feedUrl = slug ? `${appUrl}${plat.path}?slug=${slug}` : `${appUrl}${plat.path}?slug=votre-boutique`;
          return (
            <div key={plat.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
              {/* Header carte */}
              <div className="flex items-center justify-between p-5 border-b border-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: plat.color + "15" }}>
                    <plat.Icon size={22} style={{ color: plat.color }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-900">{plat.nom}</p>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: plat.badgeColor }}>
                        {plat.badge}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">{plat.description}</p>
                  </div>
                </div>
                <span className="text-xs text-gray-400 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-lg">{plat.format}</span>
              </div>

              <div className="p-5 space-y-4">
                {/* URL du feed */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-2">URL du flux à coller dans {plat.nom}</label>
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-3">
                    <code className="text-xs text-gray-700 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                      {feedUrl}
                    </code>
                    <CopyButton text={feedUrl} />
                    <a href={feedUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 px-3 py-2 rounded-xl bg-gray-100 border border-gray-200 text-gray-600 text-xs hover:bg-gray-200 transition-all flex-shrink-0">
                      <ExternalLink size={11} /> Voir
                    </a>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Avantages */}
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1"><CheckCircle size={12} className="text-green-500" /> Avantages</p>
                    <ul className="space-y-1.5">
                      {plat.avantages.map((a) => (
                        <li key={a} className="flex items-start gap-2 text-xs text-gray-600">
                          <Zap size={10} className="text-[#F5A623] mt-0.5 flex-shrink-0" /> {a}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Étapes */}
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1"><ClipboardList size={12} className="text-gray-500" /> Comment faire</p>
                    <ol className="space-y-1.5">
                      {plat.etapes.map((e, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                          <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
                            style={{ background: plat.color + "20", color: plat.color }}>
                            {i + 1}
                          </span>
                          {e}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Google Shopping gratuit — CTA spécial */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center flex-shrink-0"><Gift size={22} className="text-green-600" /></div>
          <div>
            <p className="font-bold text-green-800 text-base">Google Shopping GRATUIT — À faire en priorité</p>
            <p className="text-green-700 text-sm mt-1 leading-relaxed">
              Depuis 2020, Google permet à tous les marchands d'apparaître dans Google Shopping GRATUITEMENT.
              Soumets ton feed Google maintenant → tes produits apparaissent dans les résultats de recherche en 24-72h sans payer un centime.
            </p>
            <a href="https://merchants.google.com" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-3 px-5 py-2.5 rounded-xl font-semibold text-sm text-white"
              style={{ background: "linear-gradient(135deg, #4285F4, #34a853)" }}>
              <ExternalLink size={14} /> Ouvrir Google Merchant Center
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
