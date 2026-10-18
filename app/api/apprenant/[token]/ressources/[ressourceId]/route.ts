import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { estFichierBlob } from "@/lib/livraison-numerique";
import { leconOuverte, parcoursOuRefus, refusVerrou } from "@/lib/formation/parcours";

type Ctx = { params: Promise<{ token: string; ressourceId: string }> };

// GET — ressource téléchargeable d'une leçon : servie seulement si la leçon est ouverte pour
// cet apprenant. Même règle que /api/telechargements : l'adresse de stockage n'est jamais
// renvoyée, un fichier Blob est relayé en flux, toute autre adresse n'est jamais lue (SSRF).
export async function GET(req: NextRequest, { params }: Ctx) {
  const { token, ressourceId } = await params;
  const p = await parcoursOuRefus(req, token);
  if (p instanceof NextResponse) return p;
  const r = await prisma.ressourceLecon.findUnique({ where: { id: ressourceId }, select: { leconId: true, nom: true, url: true, mime: true } });
  const trouve = r && leconOuverte(p, r.leconId);
  if (!r || !trouve) return NextResponse.json({ error: "Ressource introuvable" }, { status: 404 });
  const refus = refusVerrou(trouve.verrou);
  if (refus) return refus;

  if (!estFichierBlob(r.url)) {
    if (!/^https:\/\//i.test(r.url)) return NextResponse.json({ error: "Ressource indisponible" }, { status: 404 });
    return NextResponse.redirect(r.url, { status: 302, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  }
  const res = await fetch(r.url, { signal: AbortSignal.timeout(60_000) }).catch(() => null);
  if (!res?.ok || !res.body) return NextResponse.json({ error: "Ressource momentanément indisponible" }, { status: 502 });
  const longueur = res.headers.get("content-length");
  return new NextResponse(res.body, {
    headers: {
      "Content-Type": r.mime || res.headers.get("content-type") || "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(r.nom)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      ...(longueur ? { "Content-Length": longueur } : {}),
    },
  });
}
