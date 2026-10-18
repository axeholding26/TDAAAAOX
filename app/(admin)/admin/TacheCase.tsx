"use client";
// Case à cocher d'une tâche assignée (Command Center → « Actions en cours »).
import { useRouter } from "next/navigation";
import { useState } from "react";
import { envoyerAction } from "@/components/command-center/client";
import { useT } from "@/components/I18nProvider";

export function TacheCase({ id, actif }: { id: string; actif: boolean }) {
  const t = useT();
  const router = useRouter();
  const [charge, setCharge] = useState(false);
  return (
    <input type="checkbox" className="mt-0.5" disabled={!actif || charge} aria-label={t("Marquer comme fait")}
      onChange={async () => { setCharge(true); if (await envoyerAction({ type: "tache", id, statut: "fait" })) router.refresh(); setCharge(false); }} />
  );
}
