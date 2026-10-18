// Lien de dépôt d'un import IA (créé par l'outil creer_lien_depot) : le jeton du lien est la
// seule autorisation. Deux usages du POST :
//  1. protocole d'envoi direct navigateur → Vercel Blob (handleUpload) : jeton d'envoi limité
//     au dossier temporaire boutiques/<id>/depot/ de LA boutique de l'import ;
//  2. { fichiers: [{ url, nom, role }] } : consomme le lien (usage unique) et lance l'import.
import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { z } from "zod";
import { rateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { dossierBoutique } from "@/lib/fichiers-boutique";
import { TYPES_FICHIERS } from "@/lib/types-fichiers";
import { finaliserDepot, lireDepot, resume, MAX, RefusImport } from "@/lib/import-creations/pipeline";

export const maxDuration = 60;
const limite = rateLimit({ windowMs: 60_000, max: 30, keyPrefix: "depot" });
const Finaliser = z.object({ fichiers: z.array(z.object({ url: z.string().url().max(2000), nom: z.string().min(1).max(200), role: z.enum(["fichier", "visuel"]) })).min(1).max(13) });

type Ctx = { params: Promise<{ jeton: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const l = limite.check(getClientIp(req));
  if (!l.success) return rateLimitResponse(l.reset);
  const { jeton } = await params;
  const corps = await req.json().catch(() => null);
  if (!corps) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });

  if (typeof corps.type === "string" && corps.type.startsWith("blob.")) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "Stockage non configuré" }, { status: 503 });
    try {
      return NextResponse.json(await handleUpload({
        body: corps as HandleUploadBody, request: req,
        onBeforeGenerateToken: async (chemin) => {
          const d = await lireDepot(jeton);
          if (!d) throw new Error("Lien expiré ou déjà utilisé");
          if (!chemin.startsWith(`${dossierBoutique(d.tenantId)}depot/`) || chemin.includes("..")) throw new Error("Dossier non autorisé");
          // Types vérifiés à nouveau par leur signature à l'import (lib/import-creations/regles.ts).
          return { allowedContentTypes: [...TYPES_FICHIERS.image, ...TYPES_FICHIERS.digital, "video/mp4", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/epub+zip"], maximumSizeInBytes: MAX.fichier, addRandomSuffix: true };
        },
        onUploadCompleted: async () => {},
      }));
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Envoi impossible" }, { status: 400 });
    }
  }

  const p = Finaliser.safeParse(corps);
  if (!p.success) return NextResponse.json({ error: "Fichiers invalides" }, { status: 400 });
  try {
    const imp = await finaliserDepot(jeton, p.data.fichiers);
    if (!imp) return NextResponse.json({ error: "Lien expiré ou déjà utilisé" }, { status: 410 });
    return NextResponse.json(resume(imp));
  } catch (e) {
    if (e instanceof RefusImport) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
