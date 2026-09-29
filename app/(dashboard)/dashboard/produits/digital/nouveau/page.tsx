"use client";
import { useRouter } from "next/navigation";
import { FileDown, Key, Package, BookOpen, ChevronRight, ArrowLeft, FileText, Music, Video, Monitor } from "lucide-react";
import Link from "next/link";
import { useT } from "@/components/I18nProvider";

const TYPES = [
  {
    id: "fichier",
    href: "/dashboard/produits/creer/fichier",
    icon: FileDown,
    label: "Fichier(s) numérique(s)",
    desc: "PDF, ZIP, MP3, vidéo — livraison automatique après paiement. Filigrane PDF inclus.",
    color: "#F5A623",
    bg: "#F5A62312",
    dispo: true,
    badge: null,
  },
  {
    id: "licence",
    href: "/dashboard/produits/creer/licence",
    icon: Key,
    label: "Clé de licence",
    desc: "Licences logiciel — génération automatique ou stock importé, contrôle des activations.",
    color: "#F5A623",
    bg: "#F5A62312",
    dispo: true,
    badge: null,
  },
  {
    id: "bundle",
    href: "/dashboard/produits/creer/bundle",
    icon: Package,
    label: "Bundle",
    desc: "Regroupez plusieurs produits existants à prix réduit. Livraison groupée automatique.",
    color: "#F5A623",
    bg: "#F5A62312",
    dispo: true,
    badge: null,
  },
  {
    id: "formation",
    href: "/dashboard/produits/creer/formation",
    icon: BookOpen,
    label: "Formation",
    desc: "Cours organisés en chapitres et leçons avec suivi de progression des apprenants.",
    color: "#F5A623",
    bg: "#F5A62312",
    dispo: true,
    badge: null,
  },
];

const LEGACY_TYPES = [
  { icon: FileText, label: "Ebook / PDF",  color: "#8A5300" },
  { icon: Video,    label: "Cours vidéo",  color: "#8A5300" },
  { icon: Monitor,  label: "Logiciel",     color: "#8A5300" },
  { icon: Music,    label: "Audio",        color: "#8A5300" },
];

export default function NouveauProduitDigitalPage() {
  const tr = useT();
  const router = useRouter();

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <Link
        href="/dashboard/produits/digital"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-8 transition-colors"
      >
        <ArrowLeft size={14} />{" "}{tr("Retour aux produits digitaux")}
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 font-poppins">{tr("Quel type de produit ?")}</h1>
        <p className="text-gray-500 text-sm mt-1">
          {tr("Choisissez le type pour accéder au wizard de création adapté.")}
        </p>
      </div>

      <div className="space-y-3 mb-10">
        {TYPES.map((t) => {
          const Icone = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => t.dispo && router.push(t.href)}
              disabled={!t.dispo}
              className={`w-full flex items-center gap-4 p-5 rounded-2xl border-2 text-left transition-all
                ${t.dispo
                  ? "border-gray-200 hover:shadow-md cursor-pointer hover:border-gray-300"
                  : "border-gray-100 opacity-50 cursor-not-allowed"
                }`}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: t.bg }}
              >
                <Icone size={22} style={{ color: t.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{tr(t.label)}</span>
                  {t.badge && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      {tr(t.badge)}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{tr(t.desc)}</p>
              </div>
              {t.dispo && <ChevronRight size={18} className="text-gray-400 flex-shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* Legacy products mention */}
      <div className="rounded-2xl border border-dashed border-gray-200 p-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          {tr("Formats classiques inclus dans \"Fichier(s) numérique(s)\"")}
        </p>
        <div className="flex flex-wrap gap-2">
          {LEGACY_TYPES.map(({ icon: Icon, label, color }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border"
              style={{ color, borderColor: color + "30", background: color + "08" }}
            >
              <Icon size={12} /> {tr(label)}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-400">
            {tr("+ tout autre format")}
          </span>
        </div>
      </div>
    </div>
  );
}
