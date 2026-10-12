// Supplier Discovery, comparaison (jusqu'à 5) et meilleur fournisseur d'un
// produit : fournisseurs de la boutique notés et classés sur le coût réel rendu
// dans son pays. ?q= &produitId= &refs=a:b,c:d &type= &moqMax= &prixMax=
// &certification= &quantite= &fraisInspection=
import { NextResponse } from "next/server";
import { accesSourcing, reponseErreur } from "@/lib/sourcing/acces";
import { rechercher } from "@/lib/sourcing/fournisseurs/service";

export async function GET(req: Request) {
  const acces = await accesSourcing();
  if (acces instanceof NextResponse) return acces;
  const p = new URL(req.url).searchParams;
  const texte = (cle: string) => p.get(cle)?.trim().slice(0, 200) || undefined;
  const nombre = (cle: string) => { const n = Number(p.get(cle)); return Number.isFinite(n) && n > 0 ? n : undefined; };
  try {
    return NextResponse.json(await rechercher(acces.tenantId, {
      q: texte("q"), produitId: texte("produitId"), type: texte("type"), certification: texte("certification"),
      refs: p.get("refs")?.slice(0, 400).split(",").filter(Boolean),
      moqMax: nombre("moqMax"), prixMax: nombre("prixMax"), quantite: nombre("quantite"),
      tco: { fraisInspection: nombre("fraisInspection") },
    }));
  } catch (e) {
    return reponseErreur(e);
  }
}
