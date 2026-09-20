import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { RejoindreForm } from "./RejoindreForm";

export default async function RejoindrePage({ params }: { params: Promise<{ programmeId: string }> }) {
  const { programmeId } = await params;

  const programme = await prisma.programmeAffiliation.findUnique({
    where: { id: programmeId },
    include: { tenant: { select: { nomBoutique: true, slug: true, logoUrl: true, devise: true } } },
  });
  if (!programme || !programme.actif) notFound();

  return (
    <RejoindreForm
      programmeId={programme.id}
      nomProgramme={programme.nom}
      description={programme.description}
      typeCommission={programme.typeCommission}
      valeurCommission={programme.valeurCommission}
      tiersActifs={programme.tiersActifs}
      tier1Nom={programme.tier1Nom}
      tier1Commission={programme.tier1Commission}
      tier3Nom={programme.tier3Nom}
      tier3Commission={programme.tier3Commission}
      dureeCookie={programme.dureeCookie}
      tenant={programme.tenant}
    />
  );
}
