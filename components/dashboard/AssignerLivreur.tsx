"use client";
import { useState } from "react";
import { toast } from "sonner";
import { UserCheck, ChevronDown, Bike, Car, User, Check } from "lucide-react";

type Livreur = { id: string; nom: string; vehicule: string; zone: string | null; disponible?: boolean };

interface Props {
  commandeId: string;
  livreurActuelId: string | null;
  livreurActuelNom?: string;
  livreurs: Livreur[];
  statut?: string;
}

const VEHICULE_ICON: Record<string, any> = {
  moto: Bike, voiture: Car, velo: Bike, a_pied: User,
};

export function AssignerLivreur({ commandeId, livreurActuelId, livreurActuelNom, livreurs, statut }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [livreurId, setLivreurId] = useState(livreurActuelId);
  const [livreurNom, setLivreurNom] = useState(livreurActuelNom);

  // Pas d'assignation possible si déjà livré ou annulé
  if (statut && ["livree", "annulee"].includes(statut)) {
    return livreurNom ? (
      <span className="text-green-400 text-xs flex items-center gap-1">
        <UserCheck size={11} /> {livreurNom}
      </span>
    ) : <span className="text-gray-600 text-xs">—</span>;
  }

  if (livreurs.length === 0) {
    return <span className="text-gray-600 text-xs">Aucun livreur</span>;
  }

  async function assigner(id: string | null, nom?: string) {
    setLoading(true);
    setOpen(false);
    try {
      const res = await fetch(`/api/commandes/${commandeId}/assigner`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ livreurId: id }),
      });
      if (!res.ok) throw new Error();
      setLivreurId(id);
      setLivreurNom(nom);
      toast.success(id ? `Assigné à ${nom}` : "Livreur retiré");
    } catch {
      toast.error("Erreur lors de l'assignation");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={loading}
        className="flex items-center gap-1.5 text-xs border border-gray-200 text-gray-600 hover:border-[#F5A623]/40 hover:text-gray-900 px-2.5 py-1.5 rounded-lg transition-all max-w-[130px]"
      >
        {livreurId ? (
          <>
            <UserCheck size={11} className="text-green-400 flex-shrink-0" />
            <span className="truncate">{livreurNom}</span>
          </>
        ) : (
          <span className="text-gray-500">Assigner...</span>
        )}
        <ChevronDown size={10} className="flex-shrink-0 ml-auto" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-52 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden">
          {livreurId && (
            <button
              onClick={() => assigner(null)}
              className="w-full px-3 py-2 text-xs text-red-500 hover:bg-red-50 text-left border-b border-gray-100"
            >
              Retirer le livreur
            </button>
          )}
          {livreurs.map((l) => (
            <button
              key={l.id}
              onClick={() => assigner(l.id, l.nom)}
              className={`w-full px-3 py-2.5 text-left hover:bg-gray-50 transition-colors ${l.id === livreurId ? "bg-amber-50" : ""}`}
            >
              <p className="text-gray-800 text-xs font-medium flex items-center gap-1.5">
                {(() => { const V = VEHICULE_ICON[l.vehicule] ?? User; return <V size={12} className="flex-shrink-0" />; })()}
                {l.nom}
                {l.disponible !== undefined && (
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${l.disponible ? "bg-green-400" : "bg-gray-500"}`} />
                )}
                {l.id === livreurId && <Check size={10} className="ml-auto text-[#F5A623]" />}
              </p>
              {l.zone && <p className="text-gray-500 text-[10px] mt-0.5 ml-5">{l.zone}</p>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
