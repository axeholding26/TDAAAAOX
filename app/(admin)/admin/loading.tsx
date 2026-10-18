// Chargement : squelettes à la place des blocs (jamais de grand spinner central).
import { getT } from "@/lib/i18n/serveur";

export default async function Chargement() {
  const t = await getT();
  return (
    <div className="space-y-5" aria-busy="true" aria-label={t("Chargement")}>
      <div className="cc-skel h-12 w-72" />
      <div className="grid gap-3 lg:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <div key={i} className="cc-skel h-48" />)}</div>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 12 }, (_, i) => <div key={i} className="cc-skel h-[108px]" />)}</div>
      <div className="grid gap-3 xl:grid-cols-[1.6fr_1fr]"><div className="cc-skel h-72" /><div className="cc-skel h-72" /></div>
    </div>
  );
}
