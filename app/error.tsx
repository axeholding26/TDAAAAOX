"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useT } from "@/components/I18nProvider";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useT();
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="min-h-screen bg-white text-[#111111] flex items-center justify-center px-4 py-16 text-center"
      style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <div className="max-w-md">
        <h1 className="text-2xl sm:text-3xl font-bold mb-3">{t("Une erreur est survenue")}</h1>
        <p className="text-[#737373] mb-8">{t("Réessayez dans un instant. Si le problème continue, contactez-nous.")}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={() => retry()} className="font-bold px-8 py-3.5 rounded-2xl"
            style={{ background: "linear-gradient(135deg,#F5A623,#d4880d)", color: "#080808" }}>
            {t("Réessayer")}
          </button>
          <Link href="/" className="font-semibold px-8 py-3.5 rounded-2xl" style={{ border: "1px solid rgba(0,0,0,0.12)" }}>
            {t("Retour à l'accueil")}
          </Link>
        </div>
      </div>
    </main>
  );
}
