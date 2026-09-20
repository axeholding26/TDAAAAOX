import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { Truck, MapPin, CheckCircle, XCircle, Bike, Car, Package } from "lucide-react";
import { getAdminSession } from "@/lib/admin-auth";

const VEHICULES: Record<string, { label: string; icon: any }> = {
  moto: { label: "Moto", icon: Bike },
  voiture: { label: "Voiture", icon: Car },
  velo: { label: "Vélo", icon: Bike },
  pied: { label: "À pied", icon: Package },
};

// Palette alignée sur la charte Axso (accent unique + sémantiques officiels).
const C = {
  accent: "#F5A623",
  success: "#16A34A",
  error: "#DC2626",
  warning: "#D97706",
  text1: "#FFFFFF",
  text2: "#AAAAAA",
  text3: "#666666",
  carte: "#1A1A1A",
  bordure: "rgba(255,255,255,0.08)",
};

export default async function AdminLivreursPage() {
  const session = await getAdminSession();
  if (!session) redirect("/dashboard");

  const livreurs = await prisma.livreur.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      tenant: { select: { nomBoutique: true, slug: true } },
      _count: { select: { commandes: true } },
    },
  });

  const independants = livreurs.filter(l => !l.tenantId);
  const attaches = livreurs.filter(l => l.tenantId);
  const disponibles = livreurs.filter(l => l.disponible && l.actif).length;

  const stats = [
    { label: "Total livreurs", value: livreurs.length, color: C.accent },
    { label: "Disponibles", value: disponibles, color: C.success },
    { label: "Indépendants", value: independants.length, color: C.text2 },
    { label: "Attachés boutique", value: attaches.length, color: C.text2 },
  ];

  const th = "px-5 py-3 text-left text-xs font-medium";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: C.text1 }}>Livreurs</h1>
        <p className="text-sm mt-1" style={{ color: C.text2 }}>{livreurs.length} livreurs sur la plateforme</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div key={i} className="rounded-2xl p-5 border" style={{ background: C.carte, borderColor: C.bordure }}>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-1" style={{ color: C.text2 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table livreurs */}
      <div className="rounded-2xl overflow-hidden border" style={{ background: C.carte, borderColor: C.bordure }}>
        <div className="px-6 py-4 border-b flex items-center gap-2" style={{ borderColor: C.bordure }}>
          <Truck size={15} style={{ color: C.accent }} />
          <h2 className="font-semibold" style={{ color: C.text1 }}>Tous les livreurs</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: C.bordure }}>
                {["Livreur", "Téléphone", "Véhicule", "Zone", "Boutique", "Livraisons", "Position", "Statut", "Inscrit le"].map(h => (
                  <th key={h} className={th} style={{ color: C.text2 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: C.bordure }}>
              {livreurs.map(l => {
                const vehicule = VEHICULES[l.vehicule] || VEHICULES.moto;
                const VehiculeIcon = vehicule.icon;
                return (
                  <tr key={l.id} className="transition-colors hover:bg-white/[0.02]">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: "rgba(245,166,35,0.12)", color: C.accent }}>
                          {l.nom.slice(0, 2).toUpperCase()}
                        </div>
                        <p className="font-medium" style={{ color: C.text1 }}>{l.nom}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs" style={{ color: C.text2 }}>{l.telephone}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5" style={{ color: C.text2 }}>
                        <VehiculeIcon size={13} />
                        <span className="text-xs">{vehicule.label}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs" style={{ color: C.text2 }}>{l.zone || "—"}</td>
                    <td className="px-5 py-4">
                      {l.tenant ? (
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(245,166,35,0.1)", color: C.accent, border: "1px solid rgba(245,166,35,0.2)" }}>
                          {l.tenant.nomBoutique}
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(255,255,255,0.06)", color: C.text2, border: `1px solid ${C.bordure}` }}>
                          Plateforme
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center" style={{ color: C.text1 }}>{l._count.commandes}</td>
                    <td className="px-5 py-4">
                      {l.latitude && l.longitude ? (
                        <div className="flex items-center gap-1 text-xs" style={{ color: C.success }}>
                          <MapPin size={11} />
                          <span>{l.latitude.toFixed(3)}, {l.longitude.toFixed(3)}</span>
                        </div>
                      ) : (
                        <span className="text-xs" style={{ color: C.text3 }}>Non partagée</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          {l.actif
                            ? <CheckCircle size={11} style={{ color: C.success }} />
                            : <XCircle size={11} style={{ color: C.error }} />}
                          <span className="text-[10px]" style={{ color: l.actif ? C.success : C.error }}>
                            {l.actif ? "Actif" : "Inactif"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full"
                            style={{ background: l.disponible ? C.success : C.text3 }} />
                          <span className="text-[10px]" style={{ color: l.disponible ? C.success : C.text3 }}>
                            {l.disponible ? "Dispo" : "Occupé"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs" style={{ color: C.text2 }}>{formatDate(l.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {livreurs.length === 0 && (
            <div className="py-16 text-center" style={{ color: C.text3 }}>
              <Truck size={32} className="mx-auto mb-3 opacity-30" />
              <p>Aucun livreur inscrit</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
