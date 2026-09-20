import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
// Vercel Pro: 300s max. Hobby: 10s (le client SSE reconnecte automatiquement)
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return new Response("Non autorisé", { status: 401 });

  const userId = (session.user as any)?.id;
  const livreur = await prisma.livreur.findUnique({ where: { userId } });
  if (!livreur) return new Response("Livreur introuvable", { status: 404 });

  const livreurId = livreur.id;
  let lastCheck = new Date();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Envoyer un ping initial
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected" })}\n\n`));

      const interval = setInterval(async () => {
        try {
          const nouvelles = await prisma.notification.findMany({
            where: { livreurId, createdAt: { gt: lastCheck }, lu: false },
            orderBy: { createdAt: "desc" },
          });

          if (nouvelles.length > 0) {
            lastCheck = new Date();
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "notifications", data: nouvelles })}\n\n`)
            );
          }

          // Aussi vérifier les nouvelles commandes assignées
          const commandesAssignees = await prisma.commande.findMany({
            where: {
              livreurId,
              statut: { in: ["confirmee", "en_preparation", "expediee"] },
              updatedAt: { gt: new Date(lastCheck.getTime() - 10000) },
            },
            select: { id: true, numero: true, clientNom: true, adresseLivraison: true, ville: true },
          });

          if (commandesAssignees.length > 0) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "commandes", data: commandesAssignees })}\n\n`)
            );
          }
        } catch {
          // Ignore DB errors in polling
        }
      }, 8000);

      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
