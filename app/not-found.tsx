import Link from "next/link";
import { getT } from "@/lib/i18n/serveur";

export default async function NotFound() {
  const t = await getT();
  return (
    <main className="min-h-screen bg-white text-[#111111] flex items-center justify-center px-4 py-16 text-center"
      style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <div className="max-w-md">
        <p className="text-6xl font-black mb-4" style={{ color: "#F5A623" }}>404</p>
        <h1 className="text-2xl sm:text-3xl font-bold mb-3">{t("Page introuvable")}</h1>
        <p className="text-[#737373] mb-8">{t("Cette page n'existe pas ou a été déplacée.")}</p>
        <Link href="/" className="inline-block font-bold px-8 py-3.5 rounded-2xl"
          style={{ background: "linear-gradient(135deg,#F5A623,#d4880d)", color: "#080808" }}>
          {t("Retour à l'accueil")}
        </Link>
      </div>
    </main>
  );
}
