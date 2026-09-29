import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  site_web: z.string().optional(), // honeypot anti-spam
});

// POST public — inscription newsletter de la boutique. L'abonné rejoint les
// clients du marchand (0 commande) : il le retrouve dans ses contacts.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Email invalide" }, { status: 400 });
  }
  if (body.site_web) return NextResponse.json({ success: true });

  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });

  const email = body.email.trim().toLowerCase();
  await prisma.client.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email } },
    create: { tenantId: tenant.id, email, nom: "Abonné newsletter" },
    update: {}, // déjà client : rien à changer
  });
  return NextResponse.json({ success: true });
}
