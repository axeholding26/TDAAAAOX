export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { resolveConfigVitrine } from "@/lib/vitrine-design";
import { FormationPlayer } from "@/components/storefront/FormationPlayer";
import { chargerParcours, delivrerCertificatSiEligible } from "@/lib/formation/parcours";

interface Props {
  params: Promise<{ slug: string; token: string }>;
}

// Portail self-service d'accès à une formation achetée — jeton opaque non devinable dans l'URL,
// aucun compte requis. Contrôles (paiement confirmé, remboursement, révocation) : lib/formation/parcours.ts.
// Seule la STRUCTURE du cours est envoyée ici ; le contenu de chaque leçon est chargé à la
// demande par /api/apprenant/[token]/lecons/[id], et jamais pour une leçon verrouillée.
export default async function FormationAccessPage({ params }: Props) {
  const { slug, token } = await params;
  const p = await chargerParcours(token);
  if (!p || p.slug !== slug) notFound();

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) notFound();
  const cfg = await resolveConfigVitrine(tenant.themeId, tenant.id, tenant.themeConfig as Record<string, any>);
  const { colors: c } = cfg;
  const certificat = await delivrerCertificatSiEligible(p);

  return (
    <div style={{ backgroundColor: c.fond, color: c.texte, minHeight: "100vh" }}>
      <FormationPlayer
        token={token}
        nomBoutique={tenant.nomBoutique}
        logoUrl={tenant.logoUrl}
        produitNom={p.produitNom}
        niveau={p.formation.niveau}
        certif={p.formation.certif}
        certificatCode={certificat && !certificat.revoqueAt ? certificat.code : null}
        derniereLeconId={p.acces.derniereLeconId}
        chapitres={p.chapitres.map((ch) => ({
          id: ch.id,
          titre: ch.titre,
          lecons: ch.lecons.map((l) => {
            const v = p.verrous.get(l.id);
            return {
              id: l.id, titre: l.titre, type: l.type, duree: l.duree, gratuite: l.gratuite,
              verrou: !v || v.ouvert ? null : v.raison === "drip" ? `S'ouvre le ${v.disponibleLe.toLocaleDateString("fr-FR")}` : `Termine d'abord : ${v.manque.join(", ")}`,
              reussi: l.type === "quiz" ? p.quizReussis.has(l.id) : l.type === "devoir" ? p.devoirs.get(l.id) === "valide" : null,
            };
          }),
        }))}
        completedIds={[...p.completes]}
        favoriIds={[...p.favoris]}
        accent={c.accent}
        fond={c.fond}
        texte={c.texte}
        surface={c.surface}
      />
    </div>
  );
}
