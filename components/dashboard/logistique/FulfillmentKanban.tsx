"use client";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { GripVertical, Clock, CheckCircle, Package, Truck, AlertTriangle, PackageCheck } from "lucide-react";
import { TRANSITIONS_VALIDES } from "@/lib/commandes";
import { formatMontant } from "@/lib/utils";

interface CommandeKanban {
  id: string;
  numero: string;
  clientNom: string;
  montantTotal: number;
  devise: string;
  statut: string;
  createdAt: string;
}

const COLONNES: { statut: string; label: string; color: string; Icon: any }[] = [
  { statut: "en_attente", label: "En attente", color: "#f59e0b", Icon: Clock },
  { statut: "confirmee", label: "Confirmée", color: "#60a5fa", Icon: CheckCircle },
  { statut: "en_preparation", label: "En préparation", color: "#8b5cf6", Icon: Package },
  { statut: "expediee", label: "Expédiée", color: "#3b82f6", Icon: Truck },
  { statut: "tentative_echouee", label: "Échec livraison", color: "#ef4444", Icon: AlertTriangle },
  { statut: "livree", label: "Livrée", color: "#10b981", Icon: PackageCheck },
];

export function FulfillmentKanban() {
  const [commandes, setCommandes] = useState<CommandeKanban[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const charger = useCallback(() => {
    fetch("/api/commandes?limit=100")
      .then((r) => r.json())
      .then((d) => setCommandes(d.commandes ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { charger(); }, [charger]);

  async function deplacer(commandeId: string, nouveauStatut: string) {
    const commande = commandes.find((c) => c.id === commandeId);
    if (!commande) return;
    if (commande.statut === nouveauStatut) return;

    const transitionsValides = TRANSITIONS_VALIDES[commande.statut] || [];
    if (!transitionsValides.includes(nouveauStatut)) {
      toast.error(`Transition impossible : ${commande.statut} → ${nouveauStatut}`);
      return;
    }

    // Optimiste
    setCommandes((prev) => prev.map((c) => (c.id === commandeId ? { ...c, statut: nouveauStatut } : c)));

    const res = await fetch(`/api/commandes/${commandeId}/statut`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: nouveauStatut }),
    });

    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error || "Erreur lors du changement de statut");
      charger(); // rollback en rechargeant l'état réel
    } else {
      toast.success(`Commande #${commande.numero} → ${COLONNES.find((c) => c.statut === nouveauStatut)?.label}`);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-6 h-6 border-2 border-[#F5A623] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex gap-4 overflow-x-auto pb-4" style={{ scrollbarWidth: "thin" }}>
      {COLONNES.map((col) => {
        const cartes = commandes.filter((c) => c.statut === col.statut);
        const survole = dragOverCol === col.statut;
        return (
          <div
            key={col.statut}
            className="flex-shrink-0 w-72 rounded-2xl border transition-colors"
            style={{
              backgroundColor: survole ? `${col.color}0A` : "#FAFAFA",
              borderColor: survole ? col.color : "#F0F0F0",
            }}
            onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.statut); }}
            onDragLeave={() => setDragOverCol((c) => (c === col.statut ? null : c))}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverCol(null);
              if (dragId) deplacer(dragId, col.statut);
            }}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "#F0F0F0" }}>
              <col.Icon size={14} style={{ color: col.color }} />
              <span className="text-[12.5px] font-bold text-[#111111]">{col.label}</span>
              <span className="ml-auto text-[11px] font-semibold text-gray-400">{cartes.length}</span>
            </div>

            <div className="p-2.5 space-y-2 min-h-[80px]">
              {cartes.length === 0 && (
                <p className="text-center text-[11px] text-gray-300 py-6">Aucune commande</p>
              )}
              {cartes.map((c) => (
                <div
                  key={c.id}
                  draggable
                  onDragStart={() => setDragId(c.id)}
                  onDragEnd={() => setDragId(null)}
                  className="bg-white border border-gray-100 rounded-xl p-3 cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow"
                  style={{ opacity: dragId === c.id ? 0.4 : 1 }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[12px] font-mono font-bold text-[#F5A623]">{c.numero}</p>
                      <p className="text-[11.5px] text-[#444] truncate mt-0.5">{c.clientNom}</p>
                    </div>
                    <GripVertical size={13} className="text-gray-300 flex-shrink-0 mt-0.5" />
                  </div>
                  <p className="text-[12px] font-bold text-[#111111] mt-2">{formatMontant(c.montantTotal, c.devise)}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
