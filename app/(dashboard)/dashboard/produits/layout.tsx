import { ProduitsSubSidebar } from "@/components/dashboard/ProduitsSubSidebar";

// Pilote du pattern sidebar à deux niveaux : sur mobile/tablette, la
// sous-sidebar reste masquée (ProduitsSubSidebar gère son propre
// `hidden lg:flex`) — la navigation module reste accessible via la sidebar
// principale, pas de régression sur petit écran.
export default function ProduitsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-6">
      <ProduitsSubSidebar />
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}
