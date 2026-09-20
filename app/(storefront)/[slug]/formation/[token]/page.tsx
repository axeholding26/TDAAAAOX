export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { resolveThemeConfigAsync } from "@/lib/theme-config-server";
import { FormationPlayer } from "@/components/storefront/FormationPlayer";

interface Props {
  params: Promise<{ slug: string; token: string }>;
}

// Portail self-service d'accès à une formation achetée — même principe que le
// portail affilié : token opaque non devinable dans l'URL, aucun compte requis.
export default async function FormationAccessPage({ params }: Props) {
  const { slug, token } = await params;

  const acces = await prisma.accesFormation.findUnique({
    where: { token },
    include: {
      produit: {
        include: {
          formation: {
            include: {
              chapitres: {
                where: { actif: true },
                orderBy: { ordre: "asc" },
                include: { lecons: { where: { actif: true }, orderBy: { ordre: "asc" } } },
              },
            },
          },
        },
      },
    },
  });
  if (!acces || !acces.produit.formation) notFound();

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant || tenant.id !== acces.produit.tenantId) notFound();

  const cfg = await resolveThemeConfigAsync(tenant.themeId, tenant.id, tenant.themeConfig as Record<string, any>);
  const { colors: c } = cfg;

  const leconIds = acces.produit.formation.chapitres.flatMap((ch) => ch.lecons.map((l) => l.id));
  const progressions = leconIds.length
    ? await prisma.progressionLecon.findMany({ where: { leconId: { in: leconIds }, clientEmail: acces.clientEmail } })
    : [];
  const completedIds = progressions.filter((p) => p.complete).map((p) => p.leconId);

  return (
    <div style={{ backgroundColor: c.fond, color: c.texte, minHeight: "100vh" }}>
      <FormationPlayer
        commandeId={acces.commandeId}
        clientEmail={acces.clientEmail}
        nomBoutique={tenant.nomBoutique}
        logoUrl={tenant.logoUrl}
        produitNom={acces.produit.nom}
        niveau={acces.produit.formation.niveau}
        certif={acces.produit.formation.certif}
        chapitres={acces.produit.formation.chapitres.map((ch) => ({
          id: ch.id,
          titre: ch.titre,
          lecons: ch.lecons.map((l) => ({
            id: l.id, titre: l.titre, type: l.type, contenu: l.contenu,
            videoType: l.videoType, videoUrl: l.videoUrl, audioUrl: l.audioUrl,
            duree: l.duree, gratuite: l.gratuite,
          })),
        }))}
        completedIds={completedIds}
        accent={c.accent}
        fond={c.fond}
        texte={c.texte}
        surface={c.surface}
      />
    </div>
  );
}
