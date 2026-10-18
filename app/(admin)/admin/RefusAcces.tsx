"use client";
// Bandeau affiché sur /admin après une redirection RBAC (?refus=1).
import { useSearchParams } from "next/navigation";
import { Note } from "@/components/command-center/ui";
import { useT } from "@/components/I18nProvider";

export function RefusAcces() {
  const t = useT();
  return useSearchParams().get("refus") === "1" ? <Note ton="warn">{t("Votre rôle ne donne pas accès à cette page.")}</Note> : null;
}
