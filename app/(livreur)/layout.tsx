import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Home, List, LogOut } from "lucide-react";
import { NotificationsPanel } from "@/components/livreur/NotificationsPanel";
import { DisponibiliteToggle } from "@/components/livreur/DisponibiliteToggle";
import { GeoTracker } from "@/components/livreur/GeoTracker";

export default async function LivreurLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/connexion");

  const role = (session.user as any)?.role;
  if (role !== "livreur") redirect("/dashboard");

  const livreur = await prisma.livreur.findFirst({
    where: { userId: (session.user as any)?.id },
    include: { tenant: { select: { nomBoutique: true } } },
  });

  if (!livreur) redirect("/connexion");

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Fond étoilé subtil */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-[#F5A623]/5 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#080810] to-transparent" />
      </div>

      {/* Header premium */}
      <header className="sticky top-0 z-50 bg-[#0A0A0A]/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo-dark.png" alt="Axso"
              style={{ height: "30px", width: "auto", objectFit: "contain", flexShrink: 0 }}
            />
            <div>
              <p className="text-white font-semibold text-sm leading-none">{livreur.nom.split(" ")[0]}</p>
              <p className="text-gray-500 text-xs">
                {livreur.tenant?.nomBoutique || "Livreur indépendant"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <DisponibiliteToggle livreurId={livreur.id} disponible={livreur.disponible} />
            <NotificationsPanel livreurId={livreur.id} />
          </div>
        </div>
      </header>

      {/* Tracker GPS silencieux */}
      <GeoTracker livreurId={livreur.id} />

      <main className="max-w-2xl mx-auto px-4 py-5 pb-24">
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0A0A0A]/95 backdrop-blur-xl border-t border-white/5 safe-area-bottom">
        <div className="max-w-2xl mx-auto px-4 py-3 grid grid-cols-3">
          <Link href="/livreur" className="flex flex-col items-center gap-1 text-gray-400 hover:text-[#F5A623] transition-colors py-1">
            <Home size={20} />
            <span className="text-[10px]">Accueil</span>
          </Link>
          <Link href="/livreur/commandes" className="flex flex-col items-center gap-1 text-gray-400 hover:text-[#F5A623] transition-colors py-1">
            <List size={20} />
            <span className="text-[10px]">Livraisons</span>
          </Link>
          <Link href="/connexion" className="flex flex-col items-center gap-1 text-gray-500 hover:text-red-400 transition-colors py-1">
            <LogOut size={20} />
            <span className="text-[10px]">Quitter</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
