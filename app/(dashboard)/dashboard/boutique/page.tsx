"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Store, Palette, Globe, Link2, Truck, Save, Loader2,
  ExternalLink, Copy, Check, Camera, Users, Music, MessageCircle,
  Mail, Phone, MapPin, CheckCircle2, Plus, X, Sparkles,
  Sliders, Power, Pause, ArrowUpRight, Package, ShoppingBag, Calendar, Share2,
  Layers, Lock,
} from "lucide-react";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { PlanBadge } from "@/components/dashboard/PlanBadge";
import { NouvelleBoutiqueModal } from "@/components/dashboard/NouvelleBoutiqueModal";
import { ModuleTutorial, BoutonRevoirTutoriel } from "@/components/dashboard/ModuleTutorial";
import { PAYS_DEVISES, PAYS_OPTIONS } from "@/lib/ai-agent";
import { aAcces, NOMS_PALIERS, type Palier } from "@/lib/plans";

const BOUTIQUE_TUTORIAL_STEPS = [
  { Icon: Store,   titre: "Complétez votre profil",        description: "Nom, description, contacts, pays... Chaque champ rempli fait grimper votre score de complétion vers 100%." },
  { Icon: Palette, titre: "Personnalisez l'apparence",      description: "Logo, bannière et thème visuel : choisissez l'ambiance qui reflète votre marque, avec un aperçu en direct." },
  { Icon: Truck,   titre: "Configurez la livraison",        description: "Frais fixes, minimum pour la livraison gratuite et zones desservies — tout est ajustable à tout moment." },
  { Icon: Layers,  titre: "Gérez plusieurs boutiques",       description: "Basculez d'une boutique à l'autre en un clic ou créez-en une nouvelle si votre palier le permet." },
];


const inputCls = "w-full bg-white border border-[#E8E8E8] rounded-2xl px-4 py-3 text-[#111111] text-[13px] leading-normal outline-none focus:border-[#F5A623]/50 focus:ring-2 focus:ring-[#F5A623]/8 transition-all placeholder:text-[#CCCCCC]";
const labelCls = "flex items-center gap-1.5 mb-1.5 ax-label leading-none";

type Section = "infos" | "apparence" | "seo" | "reseaux" | "livraison" | "boutiques" | "avance";

const SECTIONS: { id: Section; label: string; desc: string; Icon: any }[] = [
  { id: "infos",     label: "Informations",  desc: "Identité & contact",    Icon: Store   },
  { id: "apparence", label: "Apparence",     desc: "Logo, bannière, thème", Icon: Palette },
  { id: "seo",       label: "Référencement", desc: "Visibilité Google",     Icon: Globe   },
  { id: "reseaux",   label: "Réseaux",       desc: "Réseaux sociaux",       Icon: Link2   },
  { id: "livraison", label: "Livraison",     desc: "Frais & zones",         Icon: Truck   },
  { id: "boutiques", label: "Mes boutiques", desc: "Multi-boutique",        Icon: Layers  },
  { id: "avance",    label: "Avancé",        desc: "Statut & domaine",      Icon: Sliders },
];

interface AutreBoutique {
  id: string;
  slug: string;
  nomBoutique: string;
  logoUrl: string | null;
  planType: string;
  active: boolean;
  _count: { produits: number; commandes: number };
}

function palierDe(planType: string): Palier {
  return (["palier0", "palier1", "palier2"].includes(planType) ? planType : "palier0") as Palier;
}

const CHAMPS_INFOS = [
  { key: "nomBoutique", label: "Nom de la boutique *", placeholder: "Mode Aminata",           Icon: Store },
  { key: "email",       label: "Email professionnel",  placeholder: "contact@maboutique.com", type: "email", Icon: Mail },
  { key: "whatsapp",    label: "WhatsApp Business",    placeholder: "+221 77 000 00 00",      Icon: MessageCircle },
  { key: "telephone",   label: "Téléphone",            placeholder: "+221 33 000 00 00",      Icon: Phone },
  { key: "adresse",     label: "Adresse physique",     placeholder: "Rue 10, Dakar",           Icon: MapPin },
];

const CHAMPS_RESEAUX = [
  { key: "instagram", label: "Instagram",   placeholder: "https://instagram.com/votre_boutique", Icon: Camera,        color: "#E1306C" },
  { key: "facebook",  label: "Facebook",    placeholder: "https://facebook.com/votre_boutique",  Icon: Users,         color: "#111111" },
  { key: "tiktok",    label: "TikTok",      placeholder: "https://tiktok.com/@votre_boutique",   Icon: Music,         color: "#111111" },
  { key: "twitter",   label: "X / Twitter", placeholder: "https://twitter.com/votre_boutique",   Icon: MessageCircle, color: "#0F1419" },
];

export default function BoutiquePage() {
  const router = useRouter();
  const [section, setSection] = useState<Section>("infos");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  // Hôte lu côté client (évite un décalage d'hydratation) : la vitrine est servie en /<slug>.
  const [hote, setHote] = useState("");
  useEffect(() => setHote(window.location.host), []);
  const [tenant, setTenant] = useState<any>(null);
  const [statutLocal, setStatutLocal] = useState<string>("active");
  const [savingStatut, setSavingStatut] = useState(false);
  const [autresBoutiques, setAutresBoutiques] = useState<AutreBoutique[]>([]);
  const [loadingBoutiques, setLoadingBoutiques] = useState(true);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [modalNouvelleBoutique, setModalNouvelleBoutique] = useState(false);
  const [form, setForm] = useState({
    nomBoutique: "", description: "", pays: "", whatsapp: "", email: "", telephone: "", adresse: "",
    logoUrl: "", bannerUrl: "", themeId: "terre-et-or",
    metaTitle: "", metaDescription: "",
    facebook: "", instagram: "", tiktok: "", twitter: "",
    livraisonGratuite: false, fraisLivraison: "0", livraisonMin: "0", zonesLivraison: "",
  });
  const [savedForm, setSavedForm] = useState<typeof form | null>(null);

  useEffect(() => {
    fetch("/api/tenants/moi").then(r => r.json()).then(d => {
      if (d.tenant) {
        const t = d.tenant;
        setTenant(t);
        setStatutLocal(t.statut || "active");
        const social = t.socialLinks || {};
        const livraison = t.parametresLivraison || {};
        const loaded = {
          nomBoutique: t.nomBoutique || "", description: t.description || "",
          pays: t.pays || "", whatsapp: t.whatsapp || "", email: t.email || "",
          telephone: t.telephone || "", adresse: t.adresse || "",
          logoUrl: t.logoUrl || "", bannerUrl: t.bannerUrl || "", themeId: t.themeId || "terre-et-or",
          metaTitle: t.metaTitle || "", metaDescription: t.metaDescription || "",
          facebook: social.facebook || "", instagram: social.instagram || "",
          tiktok: social.tiktok || "", twitter: social.twitter || "",
          livraisonGratuite: livraison.gratuite || false,
          fraisLivraison: String(livraison.frais || 0), livraisonMin: String(livraison.minimum || 0),
          zonesLivraison: (livraison.zones || []).join(", "),
        };
        setForm(loaded);
        setSavedForm(loaded);
      }
    });
    chargerBoutiques();
  }, []);

  function chargerBoutiques() {
    setLoadingBoutiques(true);
    fetch("/api/boutiques").then(r => r.json()).then(d => {
      setAutresBoutiques(d.boutiques ?? []);
      setLoadingBoutiques(false);
    }).catch(() => setLoadingBoutiques(false));
  }

  async function switchBoutique(id: string) {
    // b peut être introuvable juste après une création (état local pas
    // encore rafraîchi) — on tente quand même le switch dans ce cas.
    if (switchingId || autresBoutiques.find(x => x.id === id)?.active) return;
    setSwitchingId(id);
    try {
      const res = await fetch("/api/boutiques/switch", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId: id }),
      });
      if (!res.ok) throw new Error();
      window.location.assign("/dashboard/boutique");
    } catch {
      toast.error("Impossible de changer de boutique — réessayez");
      setSwitchingId(null);
    }
  }

  function set(field: string, value: any) { setForm(f => ({ ...f, [field]: value })); }

  async function sauvegarder() {
    setSaving(true);
    try {
      const res = await fetch("/api/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomBoutique: form.nomBoutique, description: form.description,
          pays: form.pays, whatsapp: form.whatsapp, email: form.email,
          telephone: form.telephone, adresse: form.adresse,
          logoUrl: form.logoUrl, bannerUrl: form.bannerUrl, themeId: form.themeId,
          metaTitle: form.metaTitle, metaDescription: form.metaDescription,
          socialLinks: { facebook: form.facebook, instagram: form.instagram, tiktok: form.tiktok, twitter: form.twitter },
          parametresLivraison: {
            gratuite: form.livraisonGratuite,
            frais: parseFloat(form.fraisLivraison) || 0,
            minimum: parseFloat(form.livraisonMin) || 0,
            zones: form.zonesLivraison.split(",").map((z: string) => z.trim()).filter(Boolean),
          },
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Boutique mise à jour !");
      setSavedForm(form);
      router.refresh();
    } catch { toast.error("Erreur lors de la sauvegarde"); }
    finally { setSaving(false); }
  }

  async function toggleStatut() {
    const next = statutLocal === "active" ? "pause" : "active";
    setSavingStatut(true);
    try {
      const res = await fetch("/api/tenants", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut: next }),
      });
      if (!res.ok) throw new Error();
      setStatutLocal(next);
      toast.success(next === "active" ? "Boutique réactivée !" : "Boutique mise en pause");
      router.refresh();
    } catch { toast.error("Erreur lors du changement de statut"); }
    finally { setSavingStatut(false); }
  }

  function copierLien() {
    navigator.clipboard.writeText(`${window.location.origin}/${tenant!.slug}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  function partager() {
    const url = `${window.location.origin}/${tenant!.slug}`;
    if (navigator.share) navigator.share({ title: form.nomBoutique || "Ma Boutique", url }).catch(() => {});
    else copierLien();
  }

  const urlProd = tenant && hote ? `${hote}/${tenant.slug}` : "";
  // Aperçu décoratif — palette AXSO jaune & noir (jamais bleu ni marron).
  // Le choix du design réel de la boutique se fait dans Theme Studio
  // (voir bannière ci-dessous).
  const theme = { fond: "#ffffff", surface: "#FAFAFA", accent: "#F5A623", texte: "#111111", texteMuted: "#888888", bordure: "#F0F0F0" };
  const dirty = !!savedForm && JSON.stringify(form) !== JSON.stringify(savedForm);
  const enLigne = statutLocal === "active";

  const completion = useMemo(() => {
    const checks = [
      !!form.nomBoutique,
      !!form.description && form.description.length > 20,
      !!form.logoUrl,
      !!form.bannerUrl,
      !!(form.whatsapp || form.telephone),
      !!form.pays,
      !!(form.facebook || form.instagram || form.tiktok || form.twitter),
      !!(form.metaTitle && form.metaDescription),
      !!form.zonesLivraison,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [form]);

  const sectionDone: Record<Section, boolean> = {
    infos: !!form.nomBoutique && !!form.description,
    apparence: !!form.logoUrl && !!form.bannerUrl,
    seo: !!form.metaTitle && !!form.metaDescription,
    reseaux: !!(form.facebook || form.instagram || form.tiktok || form.twitter),
    livraison: !!form.zonesLivraison,
    boutiques: autresBoutiques.length > 1,
    avance: true,
  };

  const peutCreerBoutique = autresBoutiques.some(b => aAcces(palierDe(b.planType), "multi_boutique"));

  return (
    <div className="space-y-5 pb-24" style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <ModuleTutorial moduleKey="boutique" titre="Ma boutique" sousTitre="Vue d'ensemble du module Boutique" steps={BOUTIQUE_TUTORIAL_STEPS} />

      {/* ── Hero identité ── */}
      <div className="ax-card overflow-hidden">
        <div className="h-28 sm:h-36 relative" style={{ background: form.bannerUrl ? undefined : `linear-gradient(135deg, ${theme.accent}, ${theme.fond})` }}>
          {form.bannerUrl && <img src={form.bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/5" />
          {tenant && (
            <div className="absolute top-3 right-3 flex items-center gap-2">
              <a href={`/${tenant.slug}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[11.5px] font-semibold leading-none text-white bg-black/35 backdrop-blur-md border border-white/20 px-3 py-2 rounded-full hover:bg-black/50 transition-all">
                <ExternalLink size={11} /> <span className="hidden sm:inline">Voir la boutique</span>
              </a>
              <button onClick={partager}
                className="flex items-center gap-1.5 text-[11.5px] font-semibold leading-none text-white bg-black/35 backdrop-blur-md border border-white/20 w-8 h-8 justify-center rounded-full hover:bg-black/50 transition-all">
                {copied ? <Check size={12} className="text-[#4ade80]" /> : <Share2 size={12} />}
              </button>
            </div>
          )}
        </div>

        <div className="px-5 sm:px-7 pb-5">
          {/* Avatar — se chevauche uniquement lui-même sur la bannière */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 -mt-10 sm:-mt-12 rounded-3xl overflow-hidden ring-4 ring-white shadow-lg flex items-center justify-center relative z-10"
            style={{ background: form.logoUrl ? "#fff" : theme.fond }}>
            {form.logoUrl
              ? <img src={form.logoUrl} alt="" className="w-full h-full object-cover" />
              : <Store size={26} style={{ color: theme.accent }} />}
          </div>

          {/* Nom, statut & complétion — en flux normal, jamais superposés à la bannière */}
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-[19px] sm:text-[21px] font-bold text-[#111111] tracking-tight leading-tight truncate max-w-full">
                  {form.nomBoutique || "Ma Boutique"}
                </h1>
                <BoutonRevoirTutoriel moduleKey="boutique" />
                <button onClick={() => setSection("avance")}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold leading-none flex-shrink-0 transition-all"
                  style={enLigne ? { background: "#ECFDF5", color: "#16A34A" } : { background: "#FFFBEB", color: "#D97706" }}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: enLigne ? "#16A34A" : "#D97706" }} />
                  {enLigne ? "En ligne" : "En pause"}
                </button>
                {tenant && <PlanBadge plan={tenant.planType} size="sm" />}
              </div>
              <div className="flex items-center gap-1.5 mt-1.5 text-[12px] leading-tight text-[#AAAAAA]">
                <Globe size={11} className="flex-shrink-0" />
                <span className="truncate">{urlProd || "votre-boutique.axso.com"}</span>
                {tenant && (
                  <button onClick={copierLien}
                    className="text-[#CCCCCC] hover:text-[#888888] transition-colors flex-shrink-0">
                    <Copy size={10} />
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <ProgressRing pct={completion} />
              <div className="leading-tight">
                <p className="text-[11.5px] font-bold text-[#111111] leading-tight">Profil {completion}%</p>
                <p className="text-[10.5px] text-[#AAAAAA] leading-tight">{completion === 100 ? "Boutique complète" : "à compléter"}</p>
              </div>
            </div>
          </div>

          {/* Stats rapides */}
          {tenant?._count && (
            <div className="grid grid-cols-3 gap-2.5 mt-5">
              <StatCard Icon={Package} label="Produits" value={tenant._count.produits ?? 0} />
              <StatCard Icon={ShoppingBag} label="Commandes" value={tenant._count.commandes ?? 0} />
              <StatCard Icon={Users} label="Clients" value={tenant._count.clients ?? 0} />
            </div>
          )}
        </div>
      </div>

      {/* ── Corps : nav + contenu + preview ── */}
      <div className="grid lg:grid-cols-[220px_1fr] xl:grid-cols-[220px_1fr_340px] gap-5 items-start">

        {/* Nav rail */}
        <nav className="ax-card p-2 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible lg:sticky lg:top-5" style={{ scrollbarWidth: "none" }}>
          {SECTIONS.map(s => {
            const Icon = s.Icon;
            const active = section === s.id;
            const done = sectionDone[s.id];
            return (
              <button key={s.id} onClick={() => setSection(s.id)} title={s.label}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-2xl transition-all text-left flex-shrink-0"
                style={active ? { background: "#111111" } : { background: "transparent" }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={active ? { background: "rgba(245,166,35,0.18)" } : { background: "#F5F5F5" }}>
                  <Icon size={14} style={{ color: active ? "#F5A623" : "#888888" }} />
                </div>
                <div className="min-w-0 hidden lg:block">
                  <p className="text-[12.5px] font-semibold leading-tight truncate" style={{ color: active ? "#FFFFFF" : "#111111" }}>{s.label}</p>
                  <p className="text-[10.5px] leading-tight truncate mt-0.5" style={{ color: active ? "rgba(255,255,255,0.5)" : "#AAAAAA" }}>{s.desc}</p>
                </div>
                {done
                  ? <CheckCircle2 size={13} className="ml-auto flex-shrink-0 hidden lg:block" style={{ color: active ? "#4ade80" : "#16A34A" }} />
                  : <span className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0 hidden lg:block" style={{ background: active ? "rgba(255,255,255,0.25)" : "#E8E8E8" }} />}
              </button>
            );
          })}
        </nav>

        {/* Contenu de la section */}
        <div className="min-w-0 space-y-4">
          {section === "infos" && (
            <div className="ax-card p-6 space-y-5">
              <div>
                <h2 className="text-[14px] font-bold text-[#111111] leading-tight">Informations générales</h2>
                <p className="text-[11.5px] text-[#AAAAAA] mt-0.5 leading-tight">L'identité et les coordonnées de votre boutique</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {CHAMPS_INFOS.map(f => (
                  <div key={f.key}>
                    <label className={labelCls}><f.Icon size={11} /> {f.label}</label>
                    <input type={f.type || "text"} value={(form as any)[f.key]} placeholder={f.placeholder}
                      onChange={e => set(f.key, e.target.value)} className={inputCls} />
                  </div>
                ))}
                <div>
                  <label className={labelCls}><Globe size={11} /> Pays</label>
                  <select value={form.pays} onChange={e => set("pays", e.target.value)}
                    className={inputCls} style={{ appearance: "none" }}>
                    <option value="">Sélectionner…</option>
                    {PAYS_OPTIONS.map(p => <option key={p.code} value={p.code}>{p.nom}</option>)}
                  </select>
                  {form.pays && PAYS_DEVISES[form.pays] && (
                    <p className="text-[11px] text-[#999999] mt-1">Devise de la boutique : <strong>{PAYS_DEVISES[form.pays]}</strong> (définie par le pays)</p>
                  )}
                </div>
              </div>
              <div>
                <label className={labelCls}>Description de la boutique</label>
                <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={4}
                  placeholder="Décrivez votre boutique, vos produits, votre histoire…"
                  className={`${inputCls} resize-none`} />
                <p className="text-[10.5px] text-[#CCCCCC] mt-1 leading-tight">{form.description.length} caractères — visible sur votre page d'accueil</p>
              </div>
            </div>
          )}

          {section === "apparence" && (
            <div className="space-y-4">
              <div className="ax-card p-6 space-y-4">
                <div>
                  <h2 className="text-[14px] font-bold text-[#111111] leading-tight">Médias de la boutique</h2>
                  <p className="text-[11.5px] text-[#AAAAAA] mt-0.5 leading-tight">Le logo et la bannière apparaissent sur votre vitrine</p>
                </div>
                <div className="grid sm:grid-cols-[160px_1fr] gap-6">
                  <ImageUpload label="Logo" value={form.logoUrl} aspectRatio="circle"
                    onChange={url => set("logoUrl", url)} onRemove={() => set("logoUrl", "")}
                    hint="Carré, PNG transparent" />
                  <ImageUpload label="Bannière d'accueil" value={form.bannerUrl} aspectRatio="banner"
                    onChange={url => set("bannerUrl", url)} onRemove={() => set("bannerUrl", "")}
                    hint="Format large — 1200×400px recommandé" />
                </div>
              </div>
              <button type="button" onClick={() => router.push("/dashboard/themes")}
                className="w-full ax-card p-5 flex items-center justify-between gap-3 text-left hover:border-[#F5A623]/40 transition-all group">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={13} className="text-[#F5A623]" />
                    <h2 className="text-[13px] font-bold text-[#111111] leading-tight">Thème visuel — Theme Studio</h2>
                  </div>
                  <p className="text-[11.5px] text-[#AAAAAA] mt-1 leading-tight">15 designs prêts à l'emploi, vos vrais produits déjà branchés, ou importez le vôtre</p>
                </div>
                <ArrowUpRight size={16} className="text-[#CCCCCC] group-hover:text-[#F5A623] transition-colors flex-shrink-0" />
              </button>
            </div>
          )}

          {section === "seo" && (
            <div className="ax-card p-6 space-y-4">
              <div>
                <h2 className="text-[14px] font-bold text-[#111111] leading-tight">Référencement naturel (SEO)</h2>
                <p className="text-[11.5px] text-[#AAAAAA] mt-0.5 leading-tight">Comment votre boutique apparaît sur Google</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="ax-label leading-none">Titre méta</label>
                  <LongueurBadge n={form.metaTitle.length} min={30} max={60} />
                </div>
                <input value={form.metaTitle} onChange={e => set("metaTitle", e.target.value)} maxLength={70}
                  placeholder="Ex: Mode Aminata - Prêt-à-porter africain" className={inputCls} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="ax-label leading-none">Description méta</label>
                  <LongueurBadge n={form.metaDescription.length} min={120} max={160} />
                </div>
                <textarea value={form.metaDescription} onChange={e => set("metaDescription", e.target.value)} rows={3} maxLength={180}
                  placeholder="Description visible dans les résultats Google…"
                  className={`${inputCls} resize-none`} />
              </div>
              <div className="border border-[#E8E8E8] rounded-2xl p-4 bg-[#FAFAFA] space-y-1.5">
                <p className="ax-label mb-2 flex items-center gap-1.5 leading-none"><Sparkles size={10} /> Aperçu Google</p>
                <p className="text-[15px] font-semibold text-[#111111] leading-tight">{form.metaTitle || form.nomBoutique || "Ma Boutique"}</p>
                <p className="text-green-700 text-[11.5px] leading-tight">{urlProd || "votre-boutique.axso.com"}</p>
                <p className="text-[#666666] text-[12px] leading-relaxed">{form.metaDescription || form.description?.slice(0, 160) || "Ajoutez une description pour améliorer votre visibilité sur Google."}</p>
              </div>
            </div>
          )}

          {section === "reseaux" && (
            <div className="ax-card p-6 space-y-4">
              <div>
                <h2 className="text-[14px] font-bold text-[#111111] leading-tight">Vos liens sociaux</h2>
                <p className="text-[11.5px] text-[#AAAAAA] mt-0.5 leading-tight">Affichés dans le pied de page de votre boutique</p>
              </div>
              <div className="space-y-3">
                {CHAMPS_RESEAUX.map(s => {
                  const filled = !!(form as any)[s.key];
                  return (
                    <div key={s.key} className="flex items-center gap-3 p-2.5 rounded-2xl border transition-all"
                      style={filled ? { borderColor: `${s.color}30`, background: `${s.color}06` } : { borderColor: "#F0F0F0" }}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: filled ? `${s.color}14` : "#F5F5F5" }}>
                        <s.Icon size={14} style={{ color: filled ? s.color : "#AAAAAA" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <input value={(form as any)[s.key]} onChange={e => set(s.key, e.target.value)}
                          placeholder={`${s.label} — ${s.placeholder}`}
                          className="w-full bg-transparent outline-none text-[13px] leading-normal text-[#111111] placeholder:text-[#CCCCCC]" />
                      </div>
                      {filled && (
                        <a href={(form as any)[s.key]} target="_blank" rel="noopener noreferrer"
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 hover:bg-white transition-all">
                          <ExternalLink size={12} style={{ color: s.color }} />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {section === "livraison" && (
            <div className="ax-card p-6 space-y-5">
              <div>
                <h2 className="text-[14px] font-bold text-[#111111] leading-tight">Paramètres de livraison</h2>
                <p className="text-[11.5px] text-[#AAAAAA] mt-0.5 leading-tight">Frais et zones desservies par votre boutique</p>
              </div>
              <div className="flex items-center justify-between p-4 bg-[#FAFAFA] border border-[#F0F0F0] rounded-2xl gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#111111] leading-tight">Livraison gratuite pour tous</p>
                  <p className="text-[11.5px] text-[#AAAAAA] leading-tight mt-0.5">Offrir la livraison à tous vos clients</p>
                </div>
                <button onClick={() => set("livraisonGratuite", !form.livraisonGratuite)}
                  className="w-11 h-6 rounded-full transition-all relative flex-shrink-0"
                  style={{ background: form.livraisonGratuite ? "#F5A623" : "#E8E8E8" }}>
                  <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all"
                    style={{ left: form.livraisonGratuite ? "calc(100% - 22px)" : "2px" }} />
                </button>
              </div>
              {!form.livraisonGratuite && (
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Frais de livraison</label>
                    <input type="number" value={form.fraisLivraison} onChange={e => set("fraisLivraison", e.target.value)}
                      min="0" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Minimum pour livraison gratuite (0 = désactivé)</label>
                    <input type="number" value={form.livraisonMin} onChange={e => set("livraisonMin", e.target.value)}
                      min="0" className={inputCls} />
                  </div>
                </div>
              )}
              <div>
                <label className={labelCls}>Zones de livraison</label>
                <ZonesInput value={form.zonesLivraison} onChange={v => set("zonesLivraison", v)} />
              </div>
              <p className="text-[11.5px] text-[#888888] bg-[#FAFAFA] border border-[#F0F0F0] rounded-2xl p-3.5 leading-relaxed">
                {form.livraisonGratuite
                  ? "Tous vos clients bénéficient de la livraison gratuite, quelle que soit la zone."
                  : `Vos clients paient ${form.fraisLivraison || 0} pour la livraison${parseFloat(form.livraisonMin) > 0 ? `, offerte dès ${form.livraisonMin}` : ""}.`}
              </p>
            </div>
          )}

          {section === "boutiques" && (
            <div className="ax-card p-6 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-[14px] font-bold text-[#111111] leading-tight">Mes boutiques</h2>
                  <p className="text-[11.5px] text-[#AAAAAA] mt-0.5 leading-tight">Gérez toutes vos boutiques Axso et basculez entre elles</p>
                </div>
                {peutCreerBoutique && (
                  <button onClick={() => setModalNouvelleBoutique(true)}
                    className="flex items-center gap-1.5 text-[12px] font-bold text-white px-3.5 py-2 rounded-full hover:opacity-90 transition-all flex-shrink-0"
                    style={{ background: "#111111" }}>
                    <Plus size={13} /> Nouvelle boutique
                  </button>
                )}
              </div>

              {loadingBoutiques ? (
                <div className="grid sm:grid-cols-2 gap-3">
                  {[0, 1].map(i => <div key={i} className="h-[104px] rounded-2xl bg-[#FAFAFA] border border-[#F0F0F0] animate-pulse" />)}
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {autresBoutiques.map(b => {
                    const busy = switchingId === b.id;
                    return (
                      <button key={b.id} onClick={() => switchBoutique(b.id)} disabled={busy}
                        className="relative flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all"
                        style={{
                          borderColor: b.active ? "#F5A62360" : "#F0F0F0",
                          background: b.active ? "#FFFBF3" : "#FAFAFA",
                          cursor: b.active ? "default" : "pointer",
                        }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden text-[13px] font-black text-white"
                          style={{ background: b.logoUrl ? "#F4F4F4" : "linear-gradient(135deg,#111111,#333333)" }}>
                          {b.logoUrl ? <img src={b.logoUrl} alt="" className="w-full h-full object-cover" /> : b.nomBoutique.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold text-[#111111] leading-tight truncate">{b.nomBoutique}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full leading-none" style={{ background: "#F5A6231F", color: "#111111" }}>
                              {NOMS_PALIERS[palierDe(b.planType)]}
                            </span>
                            <span className="text-[10.5px] text-[#AAAAAA] leading-none">{b._count.produits} produits</span>
                          </div>
                        </div>
                        {busy ? (
                          <Loader2 size={14} className="animate-spin text-[#F5A623] flex-shrink-0" />
                        ) : b.active ? (
                          <span className="text-[9px] font-bold px-2 py-1 rounded-full flex-shrink-0" style={{ background: "#F5A623", color: "#fff" }}>Active</span>
                        ) : null}
                      </button>
                    );
                  })}

                  {peutCreerBoutique ? (
                    <button onClick={() => setModalNouvelleBoutique(true)}
                      className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-3.5 min-h-[76px] transition-all"
                      style={{ borderColor: "#E8E8E8" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "#F5A623"; e.currentTarget.style.background = "rgba(245,166,35,.03)"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "#E8E8E8"; e.currentTarget.style.background = "transparent"; }}>
                      <Plus size={15} className="text-[#F5A623]" />
                      <span className="text-[12.5px] font-bold text-[#666666]">Nouvelle boutique</span>
                    </button>
                  ) : (
                    <Link href="/dashboard/abonnement"
                      className="flex items-center justify-center gap-2 rounded-2xl border p-3.5 min-h-[76px] text-center transition-all hover:opacity-90"
                      style={{ borderColor: "#F0F0F0", background: "#FAFAFA" }}>
                      <Lock size={14} className="text-[#F5A623]" />
                      <span className="text-[12px] font-bold text-[#666666]">Multi-boutique — Palier 2</span>
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}

          {section === "avance" && (
            <div className="space-y-4">
              <div className="ax-card p-6 space-y-4">
                <div>
                  <h2 className="text-[14px] font-bold text-[#111111] leading-tight">Statut de la boutique</h2>
                  <p className="text-[11.5px] text-[#AAAAAA] mt-0.5 leading-tight">Mettez votre boutique en pause pendant vos fermetures</p>
                </div>
                <div className="flex items-center justify-between gap-3 p-4 rounded-2xl border flex-wrap"
                  style={enLigne ? { borderColor: "#86EFAC50", background: "#ECFDF540" } : { borderColor: "#FDE68A", background: "#FFFBEB" }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: enLigne ? "#16A34A18" : "#D9770618" }}>
                      {enLigne ? <Power size={16} style={{ color: "#16A34A" }} /> : <Pause size={16} style={{ color: "#D97706" }} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[#111111] leading-tight">{enLigne ? "Boutique en ligne" : "Boutique en pause"}</p>
                      <p className="text-[11.5px] text-[#888888] leading-tight mt-0.5">
                        {enLigne ? "Visible et accessible par tous vos clients" : "Page indisponible pour vos clients"}
                      </p>
                    </div>
                  </div>
                  <StatutToggle actif={enLigne} onConfirm={toggleStatut} loading={savingStatut} />
                </div>
              </div>

              <div className="ax-card p-6 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-[14px] font-bold text-[#111111] leading-tight">Domaine personnalisé</h2>
                    <p className="text-[11.5px] text-[#AAAAAA] mt-0.5 leading-tight">Connectez votre propre nom de domaine</p>
                  </div>
                  <Link href="/dashboard/parametres/domaine"
                    className="flex items-center gap-1 text-[11.5px] font-semibold text-[#111111] border border-[#E8E8E8] px-3 py-1.5 rounded-full hover:border-[#F5A623]/50 transition-all flex-shrink-0">
                    Configurer <ArrowUpRight size={11} />
                  </Link>
                </div>
                <div className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-[#FAFAFA] border border-[#F0F0F0] flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <Globe size={13} className="text-[#AAAAAA] flex-shrink-0" />
                    <span className="text-[12.5px] font-medium text-[#111111] truncate">{tenant?.customDomain || urlProd || "votre-boutique.axso.com"}</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full leading-none flex-shrink-0"
                    style={tenant?.customDomain ? { background: "#ECFDF5", color: "#16A34A" } : { background: "#F5F5F5", color: "#AAAAAA" }}>
                    {tenant?.customDomain ? "Domaine connecté" : "Sous-domaine par défaut"}
                  </span>
                </div>
              </div>

              <div className="ax-card p-6 space-y-3">
                <h2 className="text-[14px] font-bold text-[#111111] leading-tight">Informations du compte</h2>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-2xl bg-[#FAFAFA] border border-[#F0F0F0]">
                    <p className="ax-label leading-none mb-1.5">Plan actuel</p>
                    {tenant && <PlanBadge plan={tenant.planType} size="sm" />}
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#FAFAFA] border border-[#F0F0F0]">
                    <p className="ax-label leading-none mb-1.5 flex items-center gap-1"><Calendar size={9} /> Membre depuis</p>
                    <p className="text-[12.5px] font-semibold text-[#111111] leading-tight">
                      {tenant?.createdAt ? new Date(tenant.createdAt).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) : "—"}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#FAFAFA] border border-[#F0F0F0]">
                    <p className="ax-label leading-none mb-1.5">Identifiant boutique</p>
                    <p className="text-[12.5px] font-semibold text-[#111111] leading-tight font-mono truncate">{tenant?.id ? `${tenant.id.slice(0, 10)}…` : "—"}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Aperçu en direct */}
        <aside className="hidden xl:block xl:sticky xl:top-5">
          <LivePreview form={form} theme={theme} url={urlProd} />
        </aside>
      </div>

      {/* ── Barre de sauvegarde flottante ── */}
      {dirty && (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-[#111111] text-white pl-4 pr-2 py-2 rounded-full shadow-2xl">
          <span className="text-[12px] font-medium leading-none flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F5A623] animate-pulse" /> Modifications non enregistrées
          </span>
          <button onClick={sauvegarder} disabled={saving}
            className="flex items-center gap-1.5 font-bold text-[12px] leading-none px-4 py-2 rounded-full hover:opacity-90 disabled:opacity-50 transition-all flex-shrink-0"
            style={{ background: "#F5A623", color: "#111111" }}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            {saving ? "Sauvegarde…" : "Enregistrer"}
          </button>
        </div>
      )}

      {modalNouvelleBoutique && (
        <NouvelleBoutiqueModal
          onClose={() => setModalNouvelleBoutique(false)}
          onCree={(tenantId) => { setModalNouvelleBoutique(false); switchBoutique(tenantId); }}
        />
      )}
    </div>
  );
}

// ─── Anneau de progression ──────────────────────────────────────────────────
function ProgressRing({ pct }: { pct: number }) {
  const r = 20, c = 2 * Math.PI * r;
  return (
    <div className="relative w-12 h-12 flex-shrink-0">
      <svg viewBox="0 0 48 48" className="w-12 h-12 -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="#EFEFEF" strokeWidth="4" />
        <circle cx="24" cy="24" r={r} fill="none" stroke="#F5A623" strokeWidth="4" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} style={{ transition: "stroke-dashoffset .6s ease" }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-bold leading-none text-[#111111]">{pct}%</span>
      </div>
    </div>
  );
}

// ─── Carte de statistique rapide ─────────────────────────────────────────────
function StatCard({ Icon, label, value }: { Icon: any; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#FAFAFA] border border-[#F0F0F0]">
      <div className="w-8 h-8 rounded-xl bg-white border border-[#EFEFEF] flex items-center justify-center flex-shrink-0">
        <Icon size={13} className="text-[#F5A623]" />
      </div>
      <div className="min-w-0 leading-tight">
        <p className="text-[14px] font-bold text-[#111111] leading-tight">{value}</p>
        <p className="text-[10px] text-[#AAAAAA] leading-tight truncate">{label}</p>
      </div>
    </div>
  );
}

// ─── Bascule statut avec confirmation ────────────────────────────────────────
function StatutToggle({ actif, onConfirm, loading }: { actif: boolean; onConfirm: () => void; loading: boolean }) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 4500);
    return () => clearTimeout(t);
  }, [confirming]);

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button onClick={() => { setConfirming(false); onConfirm(); }} disabled={loading}
          className="text-[11.5px] font-bold leading-none px-3 py-2 rounded-xl disabled:opacity-60 transition-all"
          style={{ background: actif ? "#DC2626" : "#16A34A", color: "#fff" }}>
          {loading ? <Loader2 size={11} className="animate-spin" /> : actif ? "Confirmer la pause" : "Confirmer la réactivation"}
        </button>
        <button onClick={() => setConfirming(false)} className="text-[11.5px] leading-none text-[#AAAAAA] hover:text-[#888888] px-2">Annuler</button>
      </div>
    );
  }
  return (
    <button onClick={() => setConfirming(true)}
      className="text-[11.5px] font-bold leading-none px-4 py-2.5 rounded-xl flex-shrink-0 transition-all"
      style={actif ? { background: "#FEF2F2", color: "#DC2626", border: "1px solid #FCA5A5" } : { background: "#ECFDF5", color: "#16A34A", border: "1px solid #86EFAC" }}>
      {actif ? "Mettre en pause" : "Réactiver la boutique"}
    </button>
  );
}

// ─── Badge de longueur (SEO) ────────────────────────────────────────────────
function LongueurBadge({ n, min, max }: { n: number; min: number; max: number }) {
  const ok = n >= min && n <= max;
  const empty = n === 0;
  const color = empty ? "#AAAAAA" : ok ? "#16A34A" : "#D97706";
  const bg = empty ? "#F5F5F5" : ok ? "#ECFDF5" : "#FFFBEB";
  return (
    <span className="text-[10px] font-bold leading-none px-2 py-1 rounded-full" style={{ color, background: bg }}>
      {n} / {max} car.
    </span>
  );
}

// ─── Saisie des zones de livraison (chips) ──────────────────────────────────
function ZonesInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const zones = value.split(",").map(z => z.trim()).filter(Boolean);
  const [draft, setDraft] = useState("");

  function addZone() {
    const v = draft.trim();
    if (!v || zones.includes(v)) { setDraft(""); return; }
    onChange([...zones, v].join(", "));
    setDraft("");
  }
  function removeZone(z: string) {
    onChange(zones.filter(x => x !== z).join(", "));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[26px]">
        {zones.map(z => (
          <span key={z} className="inline-flex items-center gap-1 leading-none pl-3 pr-1.5 py-1.5 rounded-full text-[11.5px] font-medium"
            style={{ background: "#F5A6231A", color: "#111111", border: "1px solid #F5A62355" }}>
            {z}
            <button type="button" onClick={() => removeZone(z)} className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-[#FDE68A] transition-colors">
              <X size={9} />
            </button>
          </span>
        ))}
        {!zones.length && <p className="text-[11.5px] text-[#CCCCCC] leading-tight py-1">Aucune zone ajoutée pour l'instant</p>}
      </div>
      <div className="flex gap-2">
        <input value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addZone(); } }}
          placeholder="Ex: Dakar, Thiès, Saint-Louis…" className={inputCls} />
        <button type="button" onClick={addZone}
          className="px-4 rounded-2xl flex items-center justify-center flex-shrink-0 hover:opacity-90 transition-all"
          style={{ background: "#111111", color: "#fff" }}>
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Aperçu en direct de la vitrine ──────────────────────────────────────────
function LivePreview({ form, theme, url }: { form: any; theme: { fond: string; accent: string; texte: string }; url: string }) {
  return (
    <div className="ax-card overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[#F0F0F0] flex items-center gap-2 bg-[#FAFAFA]">
        <div className="flex gap-1 flex-shrink-0">
          <div className="w-2 h-2 rounded-full bg-[#F3B3AC]" />
          <div className="w-2 h-2 rounded-full bg-[#F5D28A]" />
          <div className="w-2 h-2 rounded-full bg-[#A9DFB0]" />
        </div>
        <div className="flex-1 min-w-0 bg-white border border-[#EFEFEF] rounded-full px-3 py-1 text-[9.5px] leading-tight text-[#AAAAAA] text-center truncate">
          {url || "votre-boutique.axso.com"}
        </div>
      </div>
      <div style={{ backgroundColor: theme.fond }}>
        <div className="h-20 relative flex items-end px-4 pb-3" style={{ background: form.bannerUrl ? undefined : `linear-gradient(135deg, ${theme.accent}30, transparent)` }}>
          {form.bannerUrl && <img src={form.bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.45), transparent)" }} />
          <div className="relative z-10 w-10 h-10 rounded-2xl overflow-hidden ring-2 flex items-center justify-center flex-shrink-0"
            style={{ background: form.logoUrl ? "#fff" : theme.accent, borderColor: theme.fond }}>
            {form.logoUrl
              ? <img src={form.logoUrl} alt="" className="w-full h-full object-cover" />
              : <Store size={16} color="#fff" />}
          </div>
        </div>
        <div className="px-4 pt-3 pb-4">
          <p style={{ color: theme.texte, fontWeight: 800, fontSize: 14, lineHeight: 1.2 }} className="truncate">{form.nomBoutique || "Ma Boutique"}</p>
          <p style={{ color: theme.texte, opacity: 0.6, fontSize: 10.5, lineHeight: 1.4 }} className="mt-1 line-clamp-2">
            {form.description || "Votre description apparaîtra ici, sur la page d'accueil de votre boutique."}
          </p>
          <div className="grid grid-cols-3 gap-1.5 mt-3.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="rounded-xl overflow-hidden" style={{ background: `${theme.texte}0A` }}>
                <div className="aspect-square" style={{ background: `${theme.accent}22` }} />
                <div className="h-1.5 w-3/4 mx-auto my-1.5 rounded-full" style={{ background: `${theme.texte}18` }} />
              </div>
            ))}
          </div>
          <div className="mt-3.5 h-8 rounded-xl flex items-center justify-center text-[10.5px] font-bold leading-none"
            style={{ background: theme.accent, color: "#fff" }}>
            Découvrir la boutique
          </div>
        </div>
      </div>
      <div className="px-4 py-2.5 border-t border-[#F0F0F0] flex items-center gap-1.5">
        <Sparkles size={10} className="text-[#F5A623] flex-shrink-0" />
        <p className="text-[10px] leading-tight text-[#AAAAAA]">Aperçu mis à jour en direct</p>
      </div>
    </div>
  );
}
