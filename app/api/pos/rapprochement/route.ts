// Rapprochement des paiements de caisse — droit : rapprochement.
// GET  /api/pos/rapprochement?debut=&fin=&mode=&sessionCaisseId=&rapprochement=&vue=&format=
//   vue : tous | remboursements | attente | doublons. format=csv : export.
//   Chaque paiement porte sa preuve réelle (prestataire | interne | pointe |
//   declare) et sa chaîne vente → paiement → prestataire → règlement → comptabilité.
// POST /api/pos/rapprochement — pointage manuel de paiements déclaratifs.
//   Corps : { ids, statut, reference?, note?, montantConstate?, cle }.
import { routePos, cleIdempotence } from "@/lib/pos/acces";
import { ErreurPos } from "@/lib/pos/erreurs";
import { STATUTS_RAPPROCHEMENT, VUES_RAPPROCHEMENT, csvPaiements, listerPaiements, pointerPaiements, schemaPointage } from "@/lib/pos/rapprochement";

function date(v: string | null, quoi: string): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new ErreurPos("invalide", 400, `La date de ${quoi} est illisible.`);
  return d;
}

export const GET = routePos(async (ctx, req) => {
  const p = new URL(req.url).searchParams;
  const vue = p.get("vue"), rapprochement = p.get("rapprochement");
  const donnees = await listerPaiements(ctx, {
    debut: date(p.get("debut"), "début"), fin: date(p.get("fin"), "fin"),
    mode: p.get("mode"), sessionCaisseId: p.get("sessionCaisseId"),
    rapprochement: (STATUTS_RAPPROCHEMENT as readonly string[]).includes(rapprochement ?? "") ? rapprochement : null,
    vue: VUES_RAPPROCHEMENT.find((v) => v === vue) ?? "tous",
  });
  if (p.get("format") !== "csv") return donnees;
  return new Response(csvPaiements(donnees.paiements), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="rapprochement-${donnees.periode.fin.slice(0, 10)}.csv"` },
  });
});

export const POST = routePos(async (ctx, req) => {
  const corps = await req.json();
  const resultat = await pointerPaiements(ctx, schemaPointage.parse({ ...corps, cle: cleIdempotence(req, corps) }));
  return { ok: true, ...resultat, ...(resultat.rejoue ? { message: "Ce pointage a déjà été enregistré." } : {}) };
});
