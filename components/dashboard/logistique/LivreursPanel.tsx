"use client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Truck, Plus, Phone, MapPin, Loader2, Globe } from "lucide-react";
import { LiveFleetMap } from "@/components/dashboard/logistique/LiveFleetMap";
import { ModuleTutorial } from "@/components/dashboard/ModuleTutorial";

const LIVREURS_TUTORIAL_STEPS = [
  { Icon: Plus,   titre: "Crée un compte livreur",         description: "Ajoute un livreur à ton équipe avec nom, téléphone, véhicule et zone de couverture." },
  { Icon: Globe,  titre: "Livreurs de la plateforme",       description: "Bascule sur l'onglet Plateforme pour voir les livreurs indépendants disponibles à assigner." },
  { Icon: MapPin, titre: "Suis la flotte en direct",        description: "La carte en haut de page affiche la position en temps réel de tes livreurs actifs." },
  { Icon: Truck,  titre: "Disponibilité en un coup d'œil",  description: "Le point vert indique qu'un livreur est disponible pour prendre une nouvelle livraison." },
];

type Livreur = {
  id: string;
  nom: string;
  telephone: string;
  vehicule: string;
  zone: string | null;
  disponible: boolean;
  actif: boolean;
  user: { email: string };
  tenant: { nomBoutique: string } | null;
  _count: { commandes: number };
};

const VEHICULE_EMOJI: Record<string, string> = {
  moto: "🏍️", voiture: "🚗", velo: "🚲", a_pied: "🚶",
};

export function LivreursPanel() {
  const [mesPlateforme, setMesPlateforme] = useState<Livreur[]>([]);
  const [plateforme, setPlateforme] = useState<Livreur[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [onglet, setOnglet] = useState<"miens" | "plateforme">("miens");
  const [form, setForm] = useState({
    nom: "", email: "", telephone: "", password: "", vehicule: "moto", zone: "",
  });

  async function charger() {
    setLoading(true);
    const [r1, r2] = await Promise.all([
      fetch("/api/livreurs").then(r => r.json()),
      fetch("/api/livreurs/plateforme").then(r => r.json()),
    ]);
    setMesPlateforme(r1.livreurs || []);
    setPlateforme(r2.livreurs || []);
    setLoading(false);
  }

  useEffect(() => { charger(); }, []);

  async function creerLivreur(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/livreurs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      toast.success("Livreur créé avec succès !");
      setShowForm(false);
      setForm({ nom: "", email: "", telephone: "", password: "", vehicule: "moto", zone: "" });
      charger();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const listeAffichee = onglet === "miens" ? mesPlateforme : plateforme;

  return (
    <div className="space-y-5">
      <ModuleTutorial moduleKey="logistique-livreurs" titre="Livreurs" sousTitre="Ta flotte de livraison" steps={LIVREURS_TUTORIAL_STEPS} />
      <div className="flex items-center justify-end">
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-[#F5A623] text-black font-semibold px-4 py-2.5 rounded-xl text-sm hover:bg-[#d4820a] transition-colors"
        >
          <Plus size={16} />
          Nouveau livreur
        </button>
      </div>

      {/* Carte flotte en direct */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        <p className="text-sm font-bold text-gray-900 mb-3">Position en temps réel</p>
        <LiveFleetMap />
      </div>

      {/* Onglets */}
      <div className="flex gap-2 bg-white border border-gray-100 rounded-xl p-1">
        <button
          onClick={() => setOnglet("miens")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
            onglet === "miens"
              ? "bg-[#F5A623] text-black"
              : "text-gray-400 hover:text-gray-900"
          }`}
        >
          Mon équipe ({mesPlateforme.length})
        </button>
        <button
          onClick={() => setOnglet("plateforme")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            onglet === "plateforme"
              ? "bg-[#F5A623] text-black"
              : "text-gray-400 hover:text-gray-900"
          }`}
        >
          <Globe size={14} />
          Plateforme ({plateforme.length})
        </button>
      </div>

      {/* Info plateforme */}
      {onglet === "plateforme" && (
        <div className="bg-[#F5A623]/5 border border-[#F5A623]/20 rounded-xl px-4 py-3">
          <p className="text-[#F5A623] text-xs">
            Ces livreurs sont indépendants et disponibles sur toute la plateforme Axso. Vous pouvez les assigner à vos commandes depuis l'onglet Livraison.
          </p>
        </div>
      )}

      {/* Formulaire création */}
      {showForm && (
        <div className="bg-white border border-[#F5A623]/20 rounded-2xl p-6">
          <h2 className="text-gray-800 font-semibold mb-4">Créer un compte livreur</h2>
          <form onSubmit={creerLivreur} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-gray-400 text-xs block mb-1.5">Nom complet *</label>
                <input
                  required value={form.nom}
                  onChange={(e) => setForm({ ...form, nom: e.target.value })}
                  placeholder="Mamadou Diallo"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-[#F5A623]/50"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1.5">Email *</label>
                <input
                  required type="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="mamadou@exemple.com"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-[#F5A623]/50"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1.5">Téléphone *</label>
                <input
                  required value={form.telephone}
                  onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                  placeholder="+221 77 000 00 00"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-[#F5A623]/50"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1.5">Mot de passe *</label>
                <input
                  required type="password" value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Min. 6 caractères"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-[#F5A623]/50"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1.5">Véhicule</label>
                <select
                  value={form.vehicule}
                  onChange={(e) => setForm({ ...form, vehicule: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-[#F5A623]/50"
                >
                  <option value="moto">🏍️ Moto</option>
                  <option value="voiture">🚗 Voiture</option>
                  <option value="velo">🚲 Vélo</option>
                  <option value="a_pied">🚶 À pied</option>
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1.5">Zone de couverture</label>
                <input
                  value={form.zone}
                  onChange={(e) => setForm({ ...form, zone: e.target.value })}
                  placeholder="Dakar centre, Plateau..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-[#F5A623]/50"
                />
              </div>
            </div>

            <div className="bg-[#F5A623]/10 border border-[#F5A623]/20 rounded-xl p-3">
              <p className="text-[#F5A623] text-xs">
                Le livreur pourra se connecter sur <strong>/connexion</strong> avec cet email et mot de passe. Il sera redirigé vers son interface dédiée.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="submit" disabled={saving}
                className="flex items-center gap-2 bg-[#F5A623] text-black font-semibold px-6 py-3 rounded-xl text-sm hover:bg-[#d4820a] transition-colors disabled:opacity-50"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Créer le compte
              </button>
              <button
                type="button" onClick={() => setShowForm(false)}
                className="px-6 py-3 rounded-xl text-sm text-gray-400 border border-gray-200 hover:border-[#F5A623]/30 transition-all"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-[#F5A623]" />
        </div>
      ) : listeAffichee.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center">
          <Truck size={32} className="text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">
            {onglet === "miens" ? "Aucun livreur dans votre équipe" : "Aucun livreur indépendant disponible"}
          </p>
          <p className="text-gray-600 text-sm mt-1">
            {onglet === "miens" ? "Créez votre première équipe de livraison" : "Les livreurs indépendants apparaîtront ici"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {listeAffichee.map((l) => (
            <div key={l.id} className="bg-white border border-gray-100 rounded-2xl p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-[#F5A623]/10 border border-[#F5A623]/20 flex items-center justify-center flex-shrink-0 text-lg">
                {VEHICULE_EMOJI[l.vehicule] || "🚚"}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-gray-800 font-semibold">{l.nom}</p>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${l.disponible ? "bg-green-400 animate-pulse" : "bg-gray-600"}`} />
                  <span className={`text-xs ${l.disponible ? "text-green-400" : "text-gray-500"}`}>
                    {l.disponible ? "Disponible" : "Hors service"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><Phone size={10} />{l.telephone}</span>
                  {l.zone && <span className="flex items-center gap-1"><MapPin size={10} />{l.zone}</span>}
                  {onglet === "plateforme" && l.tenant && (
                    <span className="text-[#F5A623]/60">{l.tenant.nomBoutique}</span>
                  )}
                  {onglet === "plateforme" && !l.tenant && (
                    <span className="text-gray-500 italic">Indépendant</span>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-[#F5A623] font-bold text-sm">{l._count.commandes}</span>
                <span className="text-gray-500 text-xs">livraisons</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
