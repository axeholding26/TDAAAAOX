"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { User, Mail, ShieldCheck, Store, LogOut, Eye, EyeOff, Loader2, Check, Crown, CalendarDays, KeyRound, ArrowLeftRight } from "lucide-react";
import { MediaUpload } from "@/components/ui/MediaUpload";
import { basculerBoutique } from "@/components/dashboard/BoutiqueSwitcher";

// « Mon profil » : le compte de la personne connectée (nom, photo, mot de
// passe, boutiques auxquelles elle a accès). Les réglages d'une boutique
// restent dans Paramètres.
interface Compte { name: string | null; email: string | null; image: string | null; role: string; createdAt: string; aMotDePasse: boolean }
interface Boutique { id: string; nomBoutique: string; slug: string; logoUrl: string | null; planType: string; active: boolean; proprietaire: boolean }

const ROLES: Record<string, string> = { owner: "Propriétaire", admin: "Administrateur", superadmin: "Super administrateur", livreur: "Livreur", membre: "Membre d'équipe" };
const PALIERS: Record<string, string> = { palier0: "Gratuit", palier1: "Palier 1", palier2: "Palier 2" };
const INPUT = "w-full h-11 px-3.5 rounded-xl border border-[#E8E8E8] bg-white text-[14px] text-[#111111] placeholder:text-[#BBBBBB] outline-none focus:border-[#F5A623] focus:ring-2 focus:ring-[#F5A623]/20 transition";

function initiales(nom: string) {
  return nom.split(/\s+/).filter(Boolean).slice(0, 2).map((m) => m[0]!.toUpperCase()).join("") || "?";
}

export default function ProfilPage() {
  const router = useRouter();
  const [compte, setCompte] = useState<Compte | null>(null);
  const [boutiques, setBoutiques] = useState<Boutique[]>([]);
  const [nom, setNom] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);

  useEffect(() => {
    fetch("/api/compte").then((r) => r.json()).then((c) => { setCompte(c); setNom(c.name ?? ""); }).catch(() => toast.error("Impossible de charger ton profil"));
    fetch("/api/boutiques").then((r) => r.json()).then((d) => setBoutiques(d.boutiques ?? [])).catch(() => {});
  }, []);

  const majCompte = async (patch: { name?: string; image?: string | null }, message: string) => {
    setEnregistrement(true);
    try {
      const res = await fetch("/api/compte", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCompte((c) => (c ? { ...c, ...data } : c));
      toast.success(message);
      router.refresh(); // nom du header
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Enregistrement impossible");
    } finally { setEnregistrement(false); }
  };

  if (!compte) {
    return <div className="flex items-center justify-center py-24 text-[#AAAAAA]"><Loader2 size={20} className="animate-spin" /></div>;
  }

  const affiche = compte.name || compte.email || "Mon compte";
  const nomModifie = nom.trim() && nom.trim() !== (compte.name ?? "");

  return (
    <div className="space-y-5 max-w-3xl w-full mx-auto pb-10" style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <div className="pt-1">
        <h1 className="text-[20px] font-bold text-[#111111] tracking-tight">Mon profil</h1>
        <p className="text-[12.5px] text-[#AAAAAA] mt-0.5">Ton compte personnel — les réglages de ta boutique sont dans Paramètres.</p>
      </div>

      {/* ── Identité ── */}
      <section className="ax-card overflow-hidden">
        <div className="h-20 sm:h-24 bg-gradient-to-r from-[#FFF3DC] via-[#FDE7B8] to-[#F5A623]/60" />
        <div className="px-5 sm:px-6 pb-5 -mt-10 sm:-mt-12 flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-4 border-white shadow-md overflow-hidden bg-[#111111] flex items-center justify-center flex-shrink-0">
            {compte.image
              ? <img src={compte.image} alt="" className="w-full h-full object-cover" />
              : <span className="text-[26px] font-bold text-[#F5A623]">{initiales(affiche)}</span>}
          </div>
          <div className="min-w-0 flex-1 sm:pb-1">
            <p className="text-[18px] font-bold text-[#111111] truncate">{affiche}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[12.5px] text-[#888888]">
              <span className="inline-flex items-center gap-1.5 min-w-0"><Mail size={13} className="flex-shrink-0" /><span className="truncate">{compte.email}</span></span>
              <span className="inline-flex items-center gap-1.5"><CalendarDays size={13} />Membre depuis {new Date(compte.createdAt).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</span>
            </div>
          </div>
          <span className="self-start sm:self-end inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold bg-[#FFF8EC] text-[#B45309] border border-[#FDE68A]">
            <Crown size={12} /> {ROLES[compte.role] ?? compte.role}
          </span>
        </div>
        <div className="px-5 sm:px-6 pb-5 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2.5 items-center">
          <MediaUpload type="image" onUrl={(url) => majCompte({ image: url }, "Photo mise à jour")} />
          {compte.image && (
            <button onClick={() => majCompte({ image: null }, "Photo retirée")} disabled={enregistrement}
              className="h-9 px-4 rounded-lg text-[13px] font-medium text-[#DC2626] border border-[#FECACA] hover:bg-[#FEF2F2] disabled:opacity-50">
              Retirer la photo
            </button>
          )}
        </div>
      </section>

      {/* ── Informations ── */}
      <section className="ax-card p-5 sm:p-6 space-y-4">
        <Titre Icon={User} titre="Informations personnelles" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-[13px] font-medium text-[#555555] mb-1.5">Nom complet</span>
            <input value={nom} onChange={(e) => setNom(e.target.value)} className={INPUT} maxLength={80} autoComplete="name" />
          </label>
          <label className="block">
            <span className="block text-[13px] font-medium text-[#555555] mb-1.5">Email de connexion</span>
            <input value={compte.email ?? ""} readOnly className={`${INPUT} bg-[#F7F7F7] text-[#888888] cursor-not-allowed`} />
            <span className="block text-[11.5px] text-[#AAAAAA] mt-1">Il sert à te connecter : il ne se modifie pas ici.</span>
          </label>
        </div>
        <div className="flex justify-end">
          <button onClick={() => majCompte({ name: nom.trim() }, "Nom mis à jour")} disabled={!nomModifie || enregistrement}
            className="h-10 px-5 rounded-xl text-[14px] font-semibold bg-[#F5A623] text-[#111111] hover:bg-[#E8990F] disabled:bg-[#EDEDED] disabled:text-[#AAAAAA] transition-colors inline-flex items-center gap-2">
            {enregistrement ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Enregistrer
          </button>
        </div>
      </section>

      {/* ── Sécurité ── */}
      <MotDePasse aMotDePasse={compte.aMotDePasse} />

      {/* ── Boutiques ── */}
      <section className="ax-card p-5 sm:p-6 space-y-4">
        <Titre Icon={Store} titre="Mes boutiques" sousTitre={`${boutiques.length} boutique${boutiques.length > 1 ? "s" : ""} accessible${boutiques.length > 1 ? "s" : ""} avec ce compte`} />
        <ul className="divide-y divide-[#F2F2F2]">
          {boutiques.map((b) => (
            <li key={b.id} className="flex items-center gap-3 py-3">
              <span className="w-10 h-10 rounded-xl overflow-hidden bg-[#FFF8EC] border border-[#FDE68A]/60 flex items-center justify-center flex-shrink-0 text-[14px] font-bold text-[#B45309]">
                {b.logoUrl ? <img src={b.logoUrl} alt="" className="w-full h-full object-cover" /> : b.nomBoutique.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-[#111111] truncate">{b.nomBoutique}</p>
                <p className="text-[12px] text-[#999999] truncate">{b.proprietaire ? "Propriétaire" : "Membre de l'équipe"} · {PALIERS[b.planType] ?? b.planType}</p>
              </div>
              {b.active
                ? <span className="flex-shrink-0 text-[12px] font-semibold px-2.5 py-1 rounded-full bg-[#DCFCE7] text-[#15803D]">Active</span>
                : <button onClick={() => basculerBoutique(b.id, "/dashboard/profil")}
                    className="flex-shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[13px] font-medium border border-[#E5E5E5] text-[#444444] hover:border-[#F5A623] hover:text-[#111111]">
                    <ArrowLeftRight size={14} /> <span className="hidden sm:inline">Basculer</span>
                  </button>}
            </li>
          ))}
        </ul>
      </section>

      <button onClick={() => signOut({ callbackUrl: "/connexion" })}
        className="w-full sm:w-auto h-11 px-5 rounded-xl inline-flex items-center justify-center gap-2 text-[14px] font-semibold text-[#DC2626] border border-[#FECACA] bg-white hover:bg-[#FEF2F2] transition-colors">
        <LogOut size={16} /> Se déconnecter
      </button>
    </div>
  );
}

function Titre({ Icon, titre, sousTitre }: { Icon: typeof User; titre: string; sousTitre?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-9 h-9 rounded-xl bg-[#FFF8EC] border border-[#FDE68A]/60 flex items-center justify-center flex-shrink-0"><Icon size={16} className="text-[#F5A623]" /></span>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-[#111111]">{titre}</h2>
        {sousTitre && <p className="text-[12px] text-[#AAAAAA]">{sousTitre}</p>}
      </div>
    </div>
  );
}

function ChampSecret({ label, value, onChange, autoComplete }: { label: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="block">
      <span className="block text-[13px] font-medium text-[#555555] mb-1.5">{label}</span>
      <span className="relative block">
        <input type={visible ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} className={`${INPUT} pr-11`} />
        <button type="button" onClick={() => setVisible((v) => !v)} aria-label={visible ? "Masquer" : "Afficher"}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-[#999999] hover:text-[#111111]">
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </span>
    </label>
  );
}

function MotDePasse({ aMotDePasse }: { aMotDePasse: boolean }) {
  const [actuel, setActuel] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const differents = !!confirmation && nouveau !== confirmation;
  const pret = actuel && nouveau.length >= 8 && nouveau === confirmation;

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pret) return;
    setEnvoi(true);
    try {
      const res = await fetch("/api/compte/mot-de-passe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actuel, nouveau }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Mot de passe modifié");
      setActuel(""); setNouveau(""); setConfirmation("");
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Modification impossible");
    } finally { setEnvoi(false); }
  };

  return (
    <section className="ax-card p-5 sm:p-6 space-y-4">
      <Titre Icon={ShieldCheck} titre="Sécurité" sousTitre="Change ton mot de passe de connexion" />
      {!aMotDePasse ? (
        <p className="text-[13px] text-[#777777] bg-[#F7F7F8] rounded-xl px-4 py-3">Ce compte se connecte sans mot de passe (connexion externe). Utilise « Mot de passe oublié » sur la page de connexion pour en définir un.</p>
      ) : (
        <form onSubmit={envoyer} className="space-y-4">
          <ChampSecret label="Mot de passe actuel" value={actuel} onChange={setActuel} autoComplete="current-password" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ChampSecret label="Nouveau mot de passe" value={nouveau} onChange={setNouveau} autoComplete="new-password" />
            <ChampSecret label="Confirmer le nouveau" value={confirmation} onChange={setConfirmation} autoComplete="new-password" />
          </div>
          <p className={`text-[12px] ${differents ? "text-[#DC2626]" : "text-[#AAAAAA]"}`}>
            {differents ? "Les deux mots de passe ne correspondent pas." : "8 caractères minimum."}
          </p>
          <div className="flex justify-end">
            <button type="submit" disabled={!pret || envoi}
              className="h-10 px-5 rounded-xl text-[14px] font-semibold bg-[#111111] text-white hover:bg-[#333333] disabled:opacity-40 transition-colors inline-flex items-center gap-2">
              {envoi ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />} Modifier le mot de passe
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
