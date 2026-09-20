import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Taux TVA par code pays ISO — Africa-first + principales devises mondiales
export const TVA_RATES: Record<string, { taux: number; nom: string; incluse: boolean }> = {
  CM: { taux: 0.1925, nom: "TVA Cameroun (19,25%)", incluse: true },
  CI: { taux: 0.18,   nom: "TVA Côte d'Ivoire (18%)", incluse: true },
  SN: { taux: 0.18,   nom: "TVA Sénégal (18%)", incluse: true },
  ML: { taux: 0.18,   nom: "TVA Mali (18%)", incluse: true },
  BF: { taux: 0.18,   nom: "TVA Burkina Faso (18%)", incluse: true },
  NE: { taux: 0.19,   nom: "TVA Niger (19%)", incluse: true },
  TG: { taux: 0.18,   nom: "TVA Togo (18%)", incluse: true },
  BJ: { taux: 0.18,   nom: "TVA Bénin (18%)", incluse: true },
  GN: { taux: 0.18,   nom: "TVA Guinée (18%)", incluse: true },
  CG: { taux: 0.185,  nom: "TVA Congo (18,5%)", incluse: true },
  GA: { taux: 0.18,   nom: "TVA Gabon (18%)", incluse: true },
  GH: { taux: 0.15,   nom: "VAT Ghana (15%)", incluse: false },
  NG: { taux: 0.075,  nom: "VAT Nigeria (7,5%)", incluse: false },
  KE: { taux: 0.16,   nom: "VAT Kenya (16%)", incluse: false },
  TZ: { taux: 0.18,   nom: "VAT Tanzania (18%)", incluse: false },
  MA: { taux: 0.20,   nom: "TVA Maroc (20%)", incluse: true },
  DZ: { taux: 0.19,   nom: "TVA Algérie (19%)", incluse: true },
  TN: { taux: 0.19,   nom: "TVA Tunisie (19%)", incluse: true },
  FR: { taux: 0.20,   nom: "TVA France (20%)", incluse: true },
  BE: { taux: 0.21,   nom: "TVA Belgique (21%)", incluse: true },
  CH: { taux: 0.081,  nom: "TVA Suisse (8,1%)", incluse: true },
  US: { taux: 0,      nom: "Pas de TVA fédérale USA", incluse: false },
  GB: { taux: 0.20,   nom: "VAT UK (20%)", incluse: false },
};

// Calculer la TVA pour une boutique
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  const slug     = searchParams.get("slug");
  const montant  = parseFloat(searchParams.get("montant") ?? "0");

  let juridiction = "CM";
  let tauxPersonnalise: number | null = null;

  if (tenantId || slug) {
    const tenant = await prisma.tenant.findFirst({
      where: tenantId ? { id: tenantId } : { slug: slug! },
      select: { juridiction: true, tauxTVA: true },
    });
    if (tenant) {
      juridiction = (tenant as any).juridiction ?? "CM";
      if (tenant.tauxTVA > 0) tauxPersonnalise = tenant.tauxTVA;
    }
  }

  const regTVA = TVA_RATES[juridiction] ?? { taux: 0, nom: "Exonéré", incluse: true };
  const taux = tauxPersonnalise !== null ? tauxPersonnalise : regTVA.taux;

  const montantHT  = regTVA.incluse ? montant / (1 + taux) : montant;
  const montantTVA = montant - montantHT;
  const montantTTC = regTVA.incluse ? montant : montant * (1 + taux);

  return NextResponse.json({
    juridiction,
    taux,
    nom: regTVA.nom,
    incluse: regTVA.incluse,
    montantHT: Math.round(montantHT * 100) / 100,
    montantTVA: Math.round(montantTVA * 100) / 100,
    montantTTC: Math.round(montantTTC * 100) / 100,
    ratesTous: TVA_RATES,
  });
}
