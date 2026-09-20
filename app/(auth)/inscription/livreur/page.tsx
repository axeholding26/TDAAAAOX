"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Truck, Loader2, CheckCircle, Bike, Car, PersonStanding, type LucideIcon } from "lucide-react";

const VEHICULES: { value: string; label: string; desc: string; Icon: LucideIcon }[] = [
  { value: "moto", label: "Moto", desc: "Idéal pour la ville", Icon: Bike },
  { value: "voiture", label: "Voiture", desc: "Pour les gros colis", Icon: Car },
  { value: "velo", label: "Vélo", desc: "Eco-responsable", Icon: Bike },
  { value: "a_pied", label: "À pied", desc: "Courtes distances", Icon: PersonStanding },
];

const inputCls = "w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm placeholder:text-gray-400 focus:border-[#F5A623] focus:ring-2 focus:ring-[#F5A623]/10 focus:outline-none transition-all";

export default function InscriptionLivreurPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [erreur, setErreur] = useState("");
  const [form, setForm] = useState({
    nom: "", email: "", telephone: "", password: "", vehicule: "moto", zone: "",
  });

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErreur("");

    try {
      const res = await fetch("/api/livreurs/inscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de la création");
      setSuccess(true);
    } catch (err: any) {
      setErreur(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white to-white flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 rounded-full bg-green-100 border border-green-200 flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 font-playfair mb-3">Compte créé !</h1>
          <p className="text-gray-400 text-sm mb-6">
            Votre compte livreur a été créé avec succès. Vous pouvez maintenant vous connecter et accéder à votre espace dédié.
          </p>
          <button
            onClick={() => router.push("/connexion")}
            className="w-full bg-[#F5A623] text-white font-bold py-3 rounded-xl hover:bg-[#D4911A] transition-all shadow-lg shadow-[#F5A623]/25"
          >
            Se connecter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-white flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-[#F5A623]/8 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-60 h-60 bg-[#F5A623]/8 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex justify-center mb-3">
            <img src="/logo.png" alt="axso" style={{ height: "56px", width: "auto", objectFit: "contain" }} />
          </Link>
          <div className="mt-3 flex items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#F5A623]/8 border border-[#F5A623]/20 flex items-center justify-center">
              <Truck size={22} className="text-[#D4911A]" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mt-3">Rejoindre comme livreur</h1>
          <p className="text-gray-400 text-sm mt-1">Recevez des commandes et gérez vos livraisons</p>
        </div>

        <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl shadow-[#F5A623]/8">
          {erreur && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm mb-5">
              {erreur}
            </div>
          )}

          <form onSubmit={soumettre} className="space-y-4">
            <div>
              <label className="block text-gray-600 text-sm font-medium mb-1.5">Nom complet *</label>
              <input required value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })}
                placeholder="Mamadou Koné" className={inputCls} />
            </div>
            <div>
              <label className="block text-gray-600 text-sm font-medium mb-1.5">Email *</label>
              <input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="mamadou@exemple.com" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-600 text-sm font-medium mb-1.5">Téléphone *</label>
                <input required value={form.telephone} onChange={e => setForm({ ...form, telephone: e.target.value })}
                  placeholder="+221 77 000 00 00" className={inputCls} />
              </div>
              <div>
                <label className="block text-gray-600 text-sm font-medium mb-1.5">Mot de passe *</label>
                <input required type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="Min. 6 caractères" className={inputCls} />
              </div>
            </div>

            <div>
              <label className="block text-gray-600 text-sm font-medium mb-2">Votre véhicule *</label>
              <div className="grid grid-cols-2 gap-2">
                {VEHICULES.map(v => (
                  <button
                    key={v.value}
                    type="button"
                    onClick={() => setForm({ ...form, vehicule: v.value })}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm transition-all ${
                      form.vehicule === v.value
                        ? "border-[#F5A623] bg-[#F5A623]/8 text-gray-900"
                        : "border-gray-100 text-gray-500 hover:border-gray-200 bg-gray-50"
                    }`}
                  >
                    <v.Icon size={16} />
                    <span className="truncate">{v.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-gray-600 text-sm font-medium mb-1.5">Ville / Zone de couverture</label>
              <input value={form.zone} onChange={e => setForm({ ...form, zone: e.target.value })}
                placeholder="Ex: Dakar, Abidjan Plateau..." className={inputCls} />
            </div>

            <div className="bg-[#F5A623]/8 border border-[#F5A623]/25 rounded-xl p-3">
              <p className="text-amber-700 text-xs leading-relaxed">
                En créant un compte, vous rejoignez la plateforme Axso en tant que livreur indépendant. Les marchands pourront vous assigner des commandes.
              </p>
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full bg-[#F5A623] text-[#111111] font-bold py-3.5 rounded-xl hover:bg-[#D4911A] transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-lg shadow-[#F5A623]/25 hover:scale-[1.02] active:scale-95"
            >
              {loading ? <><Loader2 size={16} className="animate-spin" /> Création du compte...</> : "Créer mon compte livreur"}
            </button>
          </form>
        </div>

        <div className="text-center mt-6 space-y-2">
          <Link href="/connexion" className="text-[#F5A623] hover:underline text-sm flex items-center justify-center gap-1">
            <ArrowLeft size={13} /> Retour à la connexion
          </Link>
          <p className="text-gray-400 text-xs">
            Vous voulez ouvrir une boutique ?{" "}
            <Link href="/inscription" className="text-gray-400 hover:text-[#F5A623] transition-colors underline">
              Créer un compte vendeur
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
