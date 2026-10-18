// Page de dépôt d'un import IA : ouverte par l'utilisateur depuis le lien que son assistant
// (ChatGPT, Claude, Gemini…) lui a donné. Aucune session requise : le jeton du lien suffit.
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { dossierBoutique } from "@/lib/fichiers-boutique";
import { lireDepot } from "@/lib/import-creations/pipeline";
import { getT } from "@/lib/i18n/serveur";
import DepotClient from "./DepotClient";

export const metadata: Metadata = { title: "Déposer un fichier", robots: { index: false, follow: false } };

export default async function PageDepot({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const t = await getT();
  const d = await lireDepot(jeton);
  const [imp, boutique] = d ? await Promise.all([
    prisma.importCreation.findUnique({ where: { id: d.importId }, select: { metadonnees: true, produitId: true } }),
    prisma.tenant.findUnique({ where: { id: d.tenantId }, select: { nomBoutique: true } }),
  ]) : [null, null];
  return (
    <main className="min-h-screen bg-[#FAFAF7] flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-xl bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#F5A623]">AXSO</p>
        {!d || !imp ? (
          <>
            <h1 className="text-xl font-bold text-gray-900 mt-2">{t("Lien expiré ou déjà utilisé")}</h1>
            <p className="text-sm text-gray-500 mt-2">{t("Demande à ton assistant de créer un nouveau lien de dépôt.")}</p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-gray-900 mt-2">{t("Déposer les fichiers de ton produit")}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {boutique?.nomBoutique} · {String((imp.metadonnees as any)?.nom ?? t("produit existant"))}
            </p>
            <DepotClient jeton={jeton} dossier={`${dossierBoutique(d.tenantId)}depot/`} expireLe={d.expireLe.toISOString()} fichierRequis={!imp.produitId} />
          </>
        )}
      </div>
    </main>
  );
}
