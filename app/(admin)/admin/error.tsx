"use client";
// Erreur compréhensible + réessayer, au lieu d'un écran blanc.
import { useEffect, useState } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { useT } from "@/components/I18nProvider";

export default function Erreur({ error, unstable_retry, reset }: { error: Error & { digest?: string }; unstable_retry?: () => void; reset?: () => void }) {
  const t = useT();
  const [depuis] = useState(() => Date.now());
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="cc-card p-8 flex flex-col items-center text-center gap-3 max-w-lg mx-auto mt-10">
      <AlertTriangle size={22} className="cc-warn" aria-hidden />
      <h1 className="cc-h2">{t("Les données n'ont pas pu être chargées.")}</h1>
      <p className="cc-faint text-[13px]">{error.message?.length < 160 ? t(error.message) : t("Une erreur est survenue pendant le calcul des indicateurs.")}</p>
      <button className="cc-btn cc-btn-primary" onClick={() => (unstable_retry ?? reset)?.()}><RotateCw size={14} />{t("Réessayer")}</button>
      <p className="cc-faint text-[11.5px]">{t("Erreur survenue à {0}", new Date(depuis).toLocaleTimeString(t.loc))}{error.digest ? t(" · réf. {0}", error.digest) : ""}</p>
    </div>
  );
}
