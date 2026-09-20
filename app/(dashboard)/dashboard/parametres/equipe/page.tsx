"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Users, UserPlus, Copy, MessageCircle, Trash2, ChevronDown, Ban, RefreshCw, ShieldCheck, Share2,
} from "lucide-react";
import { ModuleTutorial, BoutonRevoirTutoriel } from "@/components/dashboard/ModuleTutorial";
import { MODULES, ROLE_LABELS, type Niveau, type ModuleKey, type GrillePermissions } from "@/lib/permissions";

const EQUIPE_TUTORIAL_STEPS = [
  { Icon: UserPlus,    titre: "Invite ton équipe",              description: "Ajoute un gérant, caissier, comptable ou un accès personnalisé — un lien d'invitation est généré immédiatement." },
  { Icon: ShieldCheck, titre: "Rôles prédéfinis ou sur mesure", description: "Chaque rôle a déjà des accès configurés. Choisis \"Personnalisé\" pour régler précisément l'accès à chaque module." },
  { Icon: Share2,      titre: "Partage le lien",                 description: "Copie le lien d'invitation ou envoie-le directement par WhatsApp — inutile d'attendre l'email." },
  { Icon: Ban,         titre: "Suspends ou retire",               description: "Tu peux suspendre l'accès d'un membre à tout moment, le réactiver plus tard, ou le retirer définitivement." },
];

interface Membre {
  id: string;
  userId: string | null;
  email: string;
  nom: string;
  role: string;
  permissions: Record<string, string> | null;
  statut: "invite" | "actif" | "suspendu";
  inviteToken: string | null;
  createdAt: string;
  lienInvitation: string | null;
}

const ROLE_OPTIONS = ["gerant", "caissier", "comptable", "lecture", "personnalise"] as const;

const MODULE_LABELS: Record<ModuleKey, string> = {
  commandes: "Commandes", produits: "Produits", pos: "Point de vente", clients: "Clients",
  marketing: "Marketing", finance: "Finance", equipe: "Équipe", parametres: "Paramètres", boutique: "Boutique",
};
const NIVEAU_LABELS: Record<Niveau, string> = { aucun: "Aucun", lecture: "Lecture", ecriture: "Écriture" };

const STATUT_CFG: Record<string, { label: string; cls: string }> = {
  invite: { label: "Invité", cls: "bg-amber-100 text-amber-700" },
  actif: { label: "Actif", cls: "bg-green-100 text-green-700" },
  suspendu: { label: "Suspendu", cls: "bg-red-100 text-red-600" },
};

function permsVides(): GrillePermissions {
  return Object.fromEntries(MODULES.map((m) => [m, "aucun"])) as GrillePermissions;
}
function permsDepuisMembre(m: Membre): GrillePermissions {
  const base = permsVides();
  if (m.permissions && typeof m.permissions === "object") {
    for (const mod of MODULES) {
      const v = (m.permissions as any)[mod];
      if (v === "aucun" || v === "lecture" || v === "ecriture") base[mod] = v;
    }
  }
  return base;
}
function messageInvitation(nom: string, email: string, lien: string) {
  return `Bonjour ${nom || email}, vous êtes invité(e) à rejoindre l'équipe de notre boutique sur AXSO. Cliquez sur ce lien pour l'accepter : ${lien}`;
}

function GrillePermissionsEditor({ value, onChange }: { value: GrillePermissions; onChange: (v: GrillePermissions) => void }) {
  return (
    <div className="space-y-1.5">
      {MODULES.map((mod) => (
        <div key={mod} className="flex items-center justify-between gap-2 py-1.5 px-3 rounded-xl bg-gray-50">
          <span className="text-[12px] font-medium text-gray-700">{MODULE_LABELS[mod]}</span>
          <div className="flex items-center gap-1">
            {(["aucun", "lecture", "ecriture"] as Niveau[]).map((niveau) => {
              const actif = value[mod] === niveau;
              return (
                <button
                  key={niveau}
                  type="button"
                  onClick={() => onChange({ ...value, [mod]: niveau })}
                  className={`text-[10.5px] font-bold px-2.5 py-1 rounded-lg transition-colors ${actif ? "text-white" : "text-gray-400 hover:text-gray-600 bg-white border border-gray-200"}`}
                  style={actif ? { background: niveau === "ecriture" ? "#F5A623" : niveau === "lecture" ? "#1B2A4A" : "#9ca3af" } : undefined}
                >
                  {NIVEAU_LABELS[niveau]}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function EquipePage() {
  const [membres, setMembres] = useState<Membre[]>([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({ nom: "", email: "", role: "gerant" as string });
  const [customPerms, setCustomPerms] = useState<GrillePermissions>(permsVides());
  const [saving, setSaving] = useState(false);
  const [lastInvite, setLastInvite] = useState<{ nom: string; email: string; lienInvitation: string } | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<string>("gerant");
  const [editPerms, setEditPerms] = useState<GrillePermissions>(permsVides());
  const [savingEdit, setSavingEdit] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [retiringId, setRetiringId] = useState<string | null>(null);

  const charger = useCallback(() => {
    fetch("/api/equipe/liste")
      .then((r) => r.json())
      .then((d) => setMembres(d.membres || []))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  async function inviter(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email) { toast.error("L'email est requis"); return; }
    setSaving(true);
    try {
      const body: any = { email: form.email, nom: form.nom || undefined, role: form.role };
      if (form.role === "personnalise") body.permissions = customPerms;
      const res = await fetch("/api/equipe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'invitation");
      toast.success("Invitation envoyée !");
      setLastInvite({ nom: form.nom || form.email, email: form.email, lienInvitation: data.lienInvitation });
      setForm({ nom: "", email: "", role: "gerant" });
      setCustomPerms(permsVides());
      charger();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'invitation");
    } finally {
      setSaving(false);
    }
  }

  async function copierLien(lien: string | null) {
    if (!lien) return;
    try {
      await navigator.clipboard.writeText(lien);
      toast.success("Lien copié !");
    } catch {
      toast.error("Impossible de copier le lien");
    }
  }

  function ouvrirDetail(m: Membre) {
    if (expandedId === m.id) { setExpandedId(null); return; }
    setExpandedId(m.id);
    setEditRole(m.role);
    setEditPerms(permsDepuisMembre(m));
  }

  async function enregistrerModif(id: string) {
    setSavingEdit(true);
    try {
      const body: any = { role: editRole };
      if (editRole === "personnalise") body.permissions = editPerms;
      const res = await fetch(`/api/equipe/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      toast.success("Membre mis à jour");
      setExpandedId(null);
      charger();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la mise à jour");
    } finally {
      setSavingEdit(false);
    }
  }

  async function toggleStatut(m: Membre) {
    const nouveau = m.statut === "suspendu" ? "actif" : "suspendu";
    setTogglingId(m.id);
    try {
      const res = await fetch(`/api/equipe/${m.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ statut: nouveau }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      toast.success(nouveau === "actif" ? "Membre réactivé" : "Membre suspendu");
      charger();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setTogglingId(null);
    }
  }

  async function retirer(id: string) {
    if (!confirm("Retirer ce membre de l'équipe ?")) return;
    setRetiringId(id);
    try {
      await fetch(`/api/equipe?id=${id}`, { method: "DELETE" });
      toast.success("Membre retiré");
      setExpandedId(null);
      charger();
    } catch {
      toast.error("Erreur");
    } finally {
      setRetiringId(null);
    }
  }

  const inp = "mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#F5A623]/60";
  const lbl = "text-[10px] font-bold text-gray-400 uppercase tracking-wide";

  return (
    <div className="p-5 max-w-3xl mx-auto space-y-5" style={{ fontFamily: "'Poppins',system-ui,sans-serif" }}>
      <ModuleTutorial moduleKey="equipe" titre="Équipe" sousTitre="Rôles et accès de ton équipe" steps={EQUIPE_TUTORIAL_STEPS} />

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[18px] font-bold text-[#111]">Équipe</h1>
            <BoutonRevoirTutoriel moduleKey="equipe" />
          </div>
          <p className="text-[12px] text-gray-500">{membres.length} membre(s) dans votre équipe</p>
        </div>
      </div>

      {/* Liste membres */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <Users size={15} className="text-[#F5A623]" />
          <h2 className="text-[#111] font-semibold text-[13.5px]">Membres de l'équipe</h2>
        </div>

        {loading ? (
          <div className="py-12 text-center text-[13px] text-gray-400">Chargement…</div>
        ) : membres.length === 0 ? (
          <div className="py-10 text-center">
            <Users size={28} className="text-gray-200 mx-auto mb-3" />
            <p className="text-[13px] font-semibold text-[#111]">Aucun membre ajouté</p>
            <p className="text-[11.5px] text-gray-400 mt-1">Invitez des collaborateurs pour gérer votre boutique</p>
          </div>
        ) : (
          <div>
            {membres.map((m) => {
              const estInvite = m.statut === "invite";
              const expanded = expandedId === m.id;
              return (
                <div key={m.id} className="border-b border-gray-100 last:border-b-0">
                  <div
                    className={`p-4 flex items-center gap-3 ${!estInvite ? "cursor-pointer hover:bg-gray-50" : ""}`}
                    onClick={!estInvite ? () => ouvrirDetail(m) : undefined}
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#F5A62318" }}>
                      <span className="text-[#F5A623] font-bold text-[12px]">{(m.nom || m.email).slice(0, 2).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#111] truncate">{m.nom || m.email}</p>
                      <p className="text-[11.5px] text-gray-400 truncate">{m.email}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: "#F5A623", background: "#F5A62315" }}>
                          {ROLE_LABELS[m.role] ?? m.role}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUT_CFG[m.statut]?.cls ?? ""}`}>
                          {STATUT_CFG[m.statut]?.label ?? m.statut}
                        </span>
                      </div>
                    </div>

                    {estInvite ? (
                      <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        {m.lienInvitation && (
                          <>
                            <button onClick={() => copierLien(m.lienInvitation)} className="text-[10.5px] font-bold px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-600 flex items-center gap-1 hover:bg-gray-200 transition-colors">
                              <Copy size={11} /> Copier le lien
                            </button>
                            <a
                              href={`https://wa.me/?text=${encodeURIComponent(messageInvitation(m.nom, m.email, m.lienInvitation))}`}
                              target="_blank" rel="noopener noreferrer"
                              className="text-[10.5px] font-bold px-2.5 py-1.5 rounded-lg bg-green-500 text-white flex items-center gap-1 hover:opacity-90 transition-opacity"
                            >
                              <MessageCircle size={11} /> WhatsApp
                            </a>
                          </>
                        )}
                        <button onClick={() => retirer(m.id)} disabled={retiringId === m.id} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-300 hover:text-red-400 transition-colors disabled:opacity-50 flex-shrink-0">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ) : (
                      <ChevronDown size={15} className={`text-gray-300 flex-shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
                    )}
                  </div>

                  {expanded && (
                    <div className="px-4 pb-4 pt-1 space-y-3 bg-gray-50/60">
                      <div>
                        <label className={lbl}>Rôle</label>
                        <select value={editRole} onChange={(e) => setEditRole(e.target.value)} className={`${inp} bg-white`}>
                          {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                        </select>
                      </div>

                      {editRole === "personnalise" && (
                        <div>
                          <label className={`${lbl} mb-1.5 block`}>Accès par module</label>
                          <GrillePermissionsEditor value={editPerms} onChange={setEditPerms} />
                        </div>
                      )}

                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        <button onClick={() => enregistrerModif(m.id)} disabled={savingEdit} className="px-4 py-2 bg-[#F5A623] text-white rounded-xl text-[12px] font-bold disabled:opacity-50">
                          {savingEdit ? "…" : "Enregistrer"}
                        </button>
                        <button
                          onClick={() => toggleStatut(m)} disabled={togglingId === m.id}
                          className={`px-4 py-2 rounded-xl text-[12px] font-bold flex items-center gap-1.5 disabled:opacity-50 ${m.statut === "suspendu" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}
                        >
                          {m.statut === "suspendu" ? <><RefreshCw size={12} /> Réactiver</> : <><Ban size={12} /> Suspendre</>}
                        </button>
                        <button onClick={() => retirer(m.id)} disabled={retiringId === m.id} className="px-4 py-2 rounded-xl text-[12px] font-bold bg-red-50 text-red-500 flex items-center gap-1.5 disabled:opacity-50">
                          <Trash2 size={12} /> Retirer
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Rôles disponibles */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <h3 className="text-[#111] font-semibold text-[13px] mb-3">Rôles disponibles</h3>
        <div className="flex flex-wrap gap-2">
          {ROLE_OPTIONS.map((r) => (
            <span key={r} className="text-[11px] font-medium px-2.5 py-1 rounded-lg" style={{ color: "#F5A623", background: "#F5A62312", border: "1px solid #F5A62330" }}>
              {ROLE_LABELS[r]}
            </span>
          ))}
        </div>
      </div>

      {/* Formulaire d'invitation */}
      <form onSubmit={inviter} className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <UserPlus size={15} className="text-[#F5A623]" />
          <h2 className="text-[#111] font-semibold text-[13.5px]">Inviter un membre</h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Prénom / Nom</label>
            <input value={form.nom} onChange={(e) => setForm((v) => ({ ...v, nom: e.target.value }))} placeholder="Ex: Aminata Diallo" className={inp} />
          </div>
          <div>
            <label className={lbl}>Email *</label>
            <input type="email" required value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} placeholder="collaborateur@example.com" className={inp} />
          </div>
        </div>

        <div>
          <label className={lbl}>Rôle</label>
          <select value={form.role} onChange={(e) => setForm((v) => ({ ...v, role: e.target.value }))} className={`${inp} bg-white`}>
            {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </div>

        {form.role === "personnalise" && (
          <div>
            <label className={`${lbl} mb-1.5 block`}>Accès par module</label>
            <GrillePermissionsEditor value={customPerms} onChange={setCustomPerms} />
          </div>
        )}

        <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-[12.5px] disabled:opacity-50 transition-opacity hover:opacity-90" style={{ background: "#F5A623", color: "#fff" }}>
          <UserPlus size={13} /> {saving ? "Envoi…" : "Envoyer l'invitation"}
        </button>

        {lastInvite && (
          <div className="rounded-xl p-4 space-y-2" style={{ background: "#F5A62310", border: "1px solid #F5A62330" }}>
            <p className="text-[12px] font-semibold text-[#111]">Invitation envoyée à {lastInvite.nom} — partage ce lien :</p>
            <div className="flex items-center gap-2">
              <input readOnly value={lastInvite.lienInvitation} onFocus={(e) => e.target.select()} className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-[11.5px] text-gray-600 truncate" />
              <button type="button" onClick={() => copierLien(lastInvite.lienInvitation)} className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors flex-shrink-0">
                <Copy size={13} className="text-gray-500" />
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(messageInvitation(lastInvite.nom, lastInvite.email, lastInvite.lienInvitation))}`}
                target="_blank" rel="noopener noreferrer"
                className="p-2 rounded-lg bg-green-500 hover:opacity-90 transition-opacity flex-shrink-0"
              >
                <MessageCircle size={13} className="text-white" />
              </a>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
