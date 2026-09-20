export const dynamic = "force-dynamic";

// Storefront — Confirmation commande physique/dropshipping (paiement à la livraison)
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveThemeConfigAsync } from "@/lib/theme-config-server";
import { CommandeConfirmeeClient } from "./CommandeConfirmeeClient";
import { ImportedLiteralConfirmationShell } from "@/components/storefront/templates/ImportedLiteralConfirmationShell";
import { Lock } from "lucide-react";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ commandeId?: string }>;
}

export default async function CommandeConfirmeePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { commandeId } = await searchParams;

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant || tenant.statut !== "active") notFound();

  if (!commandeId) notFound();

  const commande = await prisma.commande.findFirst({
    where: { id: commandeId, tenantId: tenant.id },
    include: { lignes: true },
  });
  if (!commande) notFound();

  const cfg = await resolveThemeConfigAsync(
    tenant.themeId,
    tenant.id,
    (tenant.themeConfig as Record<string, any>) || {}
  );
  const theme = cfg.colors;

  const contenuConfirmation = (
    <CommandeConfirmeeClient
      commande={{
        id: commande.id,
        numero: commande.numero,
        montantTotal: commande.montantTotal,
        devise: commande.devise,
        clientNom: commande.clientNom,
        clientEmail: commande.clientEmail,
        lignes: commande.lignes.map((l) => ({
          id: l.id,
          nom: l.nom,
          quantite: l.quantite,
          prix: l.prix,
          imageUrl: l.imageUrl,
          variante: l.variante,
        })),
      }}
      theme={theme}
      slug={slug}
      nomBoutique={tenant.nomBoutique}
      tenantDevise={tenant.devise}
    />
  );

  if (cfg.builderHtmlConfirmationChrome) {
    return <ImportedLiteralConfirmationShell cfg={cfg}>{contenuConfirmation}</ImportedLiteralConfirmationShell>;
  }

  return (
    <div style={{ backgroundColor: theme.fond, color: theme.texte, minHeight: "100vh" }}>
      {/* Navbar minimal */}
      <nav style={{ borderBottomColor: `${theme.accent}20` }} className="border-b">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href={`/${slug}`}>
            <span className="text-xl font-bold font-playfair" style={{ color: theme.accent }}>
              {tenant.nomBoutique}
            </span>
          </Link>
          <div className="flex items-center gap-2 text-sm opacity-50">
            <span className="text-xs">Commande sécurisée</span>
            <Lock size={14} />
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-12">
        {contenuConfirmation}
      </div>

      <footer
        className="border-t py-8 text-center text-sm opacity-40 mt-8"
        style={{ borderColor: `${theme.accent}20` }}
      >
        <p>
          {tenant.nomBoutique} · Propulsé par{" "}
          <span style={{ color: theme.accent }}>Axso</span>
        </p>
      </footer>
    </div>
  );
}
