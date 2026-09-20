import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { envoyerMessageContact } from "@/lib/email";
import { z } from "zod";

const schema = z.object({
  nom: z.string().min(1),
  email: z.string().email(),
  message: z.string().min(1),
  site_web: z.string().optional(), // honeypot anti-spam
});

// POST public — formulaire de contact de la boutique, pas de session requise.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }

  // Piège à bots : un humain ne remplit jamais ce champ caché. On répond
  // succès sans rien envoyer, pour ne jamais révéler au bot qu'il a été détecté.
  if (body.site_web) return NextResponse.json({ success: true });

  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { email: true, nomBoutique: true } });
  if (!tenant) return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });

  try {
    await envoyerMessageContact({
      emailMarchand: tenant.email,
      boutique: tenant.nomBoutique,
      nom: body.nom,
      emailClient: body.email,
      message: body.message,
    });
  } catch (err) {
    console.warn("[CONTACT] échec envoi email", err);
    // Le message a bien été soumis — un souci d'envoi email ne doit pas se
    // traduire par une erreur côté client, qui a fait ce qu'il fallait.
  }

  return NextResponse.json({ success: true });
}
