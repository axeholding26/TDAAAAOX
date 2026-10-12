// IA d'un produit sourcé : copilote (analyse), kit de test (page + angles),
// publicités. Le résultat est enregistré sur la fiche pour être relu sans
// relancer l'IA. Voir les garde-fous dans lib/sourcing/ia.ts.
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { aiLimiter, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { accesSourcing, contexteCalcul, erreur, reponseErreur } from "@/lib/sourcing/acces";
import { evaluerProduit } from "@/lib/sourcing/produit-source";
import { analyserProduit, genererKitTest, genererPublicites } from "@/lib/sourcing/ia";

const schema = z.object({ type: z.enum(["copilote", "kit", "publicites"]) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const acces = await accesSourcing();
  if (acces instanceof NextResponse) return acces;
  const rl = aiLimiter.check(`${acces.tenantId}:${getClientIp(req)}`);
  if (!rl.success) return rateLimitResponse(rl.reset);
  const { id } = await params;
  try {
    const { type } = schema.parse(await req.json());
    const source = await prisma.produitSource.findFirst({ where: { id, tenantId: acces.tenantId } });
    if (!source) return erreur("Produit introuvable", 404);
    const ctx = await contexteCalcul(acces.tenantId);
    const ev = evaluerProduit(source, ctx);
    const date = new Date().toISOString();

    if (type === "copilote") {
      const analyseIA = { ...(await analyserProduit(source, ev, ctx)), date };
      await prisma.produitSource.update({ where: { id }, data: { analyseIA } });
      return NextResponse.json({ analyseIA });
    }
    if (type === "kit") {
      const kitTest = { ...(await genererKitTest(source, ev, ctx)), date };
      await prisma.produitSource.update({ where: { id }, data: { kitTest } });
      return NextResponse.json({ kitTest });
    }
    const publicites = { variantes: await genererPublicites(source, ev, ctx), date };
    await prisma.produitSource.update({ where: { id }, data: { publicites: publicites as object } });
    return NextResponse.json({ publicites });
  } catch (e) {
    return reponseErreur(e);
  }
}
