export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShieldCheck, ShieldX } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getT } from "@/lib/i18n/serveur";
import { normaliserCodeCertificat } from "@/lib/formation/regles";

export const metadata: Metadata = { title: "Vérification d'attestation", robots: { index: false } };

// Vérification publique minimale d'une attestation : nom, formation, date, statut.
// Identifiant de 80 bits aléatoires : impossible à deviner, on n'expose rien d'autre.
export default async function VerificationCertificat({ params }: { params: Promise<{ slug: string; code: string }> }) {
  const { slug, code } = await params;
  const t = await getT();
  const normalise = normaliserCodeCertificat(decodeURIComponent(code));
  const c = normalise
    ? await prisma.certificat.findUnique({ where: { code: normalise }, select: { code: true, nom: true, formationTitre: true, boutiqueNom: true, delivreAt: true, revoqueAt: true, tenantId: true } })
    : null;
  const tenant = c ? await prisma.tenant.findUnique({ where: { slug }, select: { id: true } }) : null;
  if (!c || tenant?.id !== c.tenantId) notFound();
  const valide = !c.revoqueAt;
  const date = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          {valide ? <ShieldCheck className="text-emerald-600" size={28} /> : <ShieldX className="text-red-600" size={28} />}
          <div>
            <p className="text-lg font-bold text-gray-900">{valide ? t("Attestation valide") : t("Attestation révoquée")}</p>
            <p className="text-xs font-mono text-gray-500">{c.code}</p>
          </div>
        </div>
        <dl className="text-sm space-y-2">
          <div className="flex justify-between gap-4"><dt className="text-gray-500">{t("Titulaire")}</dt><dd className="font-semibold text-gray-900 text-right">{c.nom}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-gray-500">{t("Formation")}</dt><dd className="font-semibold text-gray-900 text-right">{c.formationTitre}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-gray-500">{t("Formateur")}</dt><dd className="text-gray-900 text-right">{c.boutiqueNom}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-gray-500">{t("Délivrée le")}</dt><dd className="text-gray-900 text-right">{date(c.delivreAt)}</dd></div>
          {c.revoqueAt && <div className="flex justify-between gap-4"><dt className="text-gray-500">{t("Révoquée le")}</dt><dd className="text-red-600 text-right">{date(c.revoqueAt)}</dd></div>}
        </dl>
        <p className="text-[11px] leading-relaxed text-gray-500 border-t border-gray-100 pt-4">
          {t("Attestation interne délivrée par le formateur via Axso après réussite de son cours. Ce n'est ni un diplôme ni une certification accréditée par un organisme officiel.")}
        </p>
      </div>
    </main>
  );
}
