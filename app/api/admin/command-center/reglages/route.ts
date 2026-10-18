// Réglages du Command Center (seuils, objectifs, pondérations, activation, rapports planifiés).
// Validés par schéma, réservés au Super admin et au CEO, journalisés (avant / après).
import { NextResponse, type NextRequest } from "next/server";
import { getAdminSessionPour } from "@/lib/admin-auth";
import { peutReglerCC } from "@/lib/command-center/rbac";
import { ecrireReglage } from "@/lib/command-center/serveur";
import { SCHEMAS, type CleReglage } from "@/lib/command-center/reglages";
import { ZodError } from "zod";

const MODIFIABLES: CleReglage[] = ["seuils", "objectifs", "poids_sante", "activation", "rapports"];

export async function PUT(req: NextRequest) {
  const session = await getAdminSessionPour("reglages");
  if (!session || !peutReglerCC(session.role)) return NextResponse.json({ erreur: "Réservé au Super admin et au CEO" }, { status: 403 });
  const corps = await req.json().catch(() => null) as { cle?: string; valeur?: unknown } | null;
  const cle = corps?.cle as CleReglage;
  if (!MODIFIABLES.includes(cle) || !(cle in SCHEMAS)) return NextResponse.json({ erreur: "Réglage inconnu" }, { status: 400 });
  try {
    return NextResponse.json({ valeur: await ecrireReglage(session, cle, corps!.valeur), message: "Réglage enregistré" });
  } catch (e) {
    if (e instanceof ZodError) return NextResponse.json({ erreur: "Valeurs invalides : " + e.issues.map((i) => i.path.join(".") + " " + i.message).slice(0, 3).join(" ; ") }, { status: 400 });
    throw e;
  }
}
