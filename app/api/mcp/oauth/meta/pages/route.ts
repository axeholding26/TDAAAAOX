// Liste les pages/comptes Meta disponibles pour ce tenant + sélection de page.
// Les jetons d'accès des pages restent côté serveur : jamais renvoyés au navigateur,
// jamais acceptés de lui (la page choisie est cherchée dans la config enregistrée).
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { lireConnexion, enregistrerConnexion } from "@/lib/connect";
import { z } from "zod";

export async function GET() {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const config = await lireConnexion(tenantId, "meta");

  if (!config) return NextResponse.json({ pages: [], waba: [], connected: false });

  const cfg = config.config as any;
  return NextResponse.json({
    connected: true,
    user_name: cfg.user_name,
    user_picture: cfg.user_picture,
    pages: (cfg.pages ?? []).map(({ access_token, ...page }: any) => page),
    waba_accounts: cfg.waba_accounts ?? [],
    selected_page_id: config.pageId,
    selected_ig_id: config.igUserId,
  });
}

const selectSchema = z.object({ page_id: z.string() });

export async function POST(req: NextRequest) {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const parsed = selectSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Format invalide" }, { status: 400 });

  const config = await lireConnexion(tenantId, "meta");
  const page = ((config?.config as any)?.pages ?? []).find((p: any) => p.id === parsed.data.page_id);
  if (!page) return NextResponse.json({ error: "Page introuvable" }, { status: 404 });

  await enregistrerConnexion(tenantId, "meta", {
    pageId: page.id,
    accessToken: page.access_token,
    igUserId: page.ig_account?.id ?? null,
    statut: "actif",
  });

  return NextResponse.json({ ok: true });
}
