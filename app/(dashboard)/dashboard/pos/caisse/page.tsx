// Écran de caisse. Drapeau `caisse_v2` allumé : nouvel écran AXSO POS 2.0
// (EcranCaisse, tout côté client : il démarre par GET /api/pos/reglages, qui
// authentifie et rend les droits). Drapeau éteint : l'ancienne caisse (POSPanel,
// /api/commandes/pos-creer) reste en service, comme dans le kiosque.
import Link from "next/link";
import { auth } from "@/lib/auth";
import { POSPanel } from "@/components/dashboard/logistique/POSPanel";
import { EcranCaisse } from "@/components/pos/caisse/EcranCaisse";
import { flagActif } from "@/lib/pos/flags";
import { getT } from "@/lib/i18n/serveur";

export const metadata = { title: "Caisse" };

export default async function PageCaisse() {
  const session = await auth();
  const tenantId = (session?.user as { tenantId?: string | null } | undefined)?.tenantId;
  // Réglages illisibles : l'ancienne caisse, qui ne dépend pas d'eux.
  const v2 = tenantId ? await flagActif(tenantId, "caisse_v2").catch(() => false) : false;
  if (v2) return <EcranCaisse />;
  const t = await getT();
  return (
    <div className="space-y-3">
      <p role="note" className="rounded-xl border border-[#E8E8E8] bg-[#FAFAFA] px-3 py-2 text-[12.5px] text-[#555555]">
        {t("Vous utilisez l'ancienne caisse. Le nouvel écran de caisse (scan par téléphone, sessions, retours, hors ligne) s'active dans")}{" "}
        <Link href="/dashboard/pos/demarrage" className="font-semibold text-[#111111] underline">{t("Mise en route")}</Link>.
      </p>
      <POSPanel />
    </div>
  );
}
