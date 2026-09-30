// AXIA admin — assistante de l'administrateur : lit toute la plateforme et
// prépare les actions de l'admin, qui ne partent qu'après son accord
// (app/api/admin/axia/actions). Séparée de l'AXIA marchand (app/api/ai/axia).
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { runAgent, type ToolExecutor } from "@/lib/agent-runner";
import { getAdminSession, estAdminComplet } from "@/lib/admin-auth";
import { getPlatformTenantId } from "@/lib/wallet";
import { OUTILS_LECTURE, OUTILS_ACTION, estActionAdmin, executerLecture, decrireAction } from "@/lib/axia-admin/outils";

export const maxDuration = 60;

const schema = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).max(40),
});

const PROMPT = `Tu es AXIA, l'assistante de l'administrateur de la plateforme AXSO (e-commerce, Afrique francophone).
Tu l'aides à suivre et à gérer la plateforme : boutiques, abonnements, commandes, revenus, wallet, AxSocial, équipe, livreurs.
Tu réponds de façon concise et factuelle, en français par défaut. Tu n'inventes jamais de chiffre : tu n'annonces que ce que tes outils renvoient.
Pour agir sur une boutique, trouve d'abord son id avec chercher_boutiques ; si plusieurs boutiques correspondent, demande laquelle.`;

const CONSIGNE_ACTIONS = `─── ACTIONS : ACCORD DE L'ADMIN ───
Quand tu appelles un outil d'action, rien n'est exécuté tout de suite : une carte « Autoriser / Refuser » s'affiche sous ta réponse. Dis en une phrase ce que tu t'apprêtes à faire et que tu attends son accord ; ne dis jamais que c'est fait.`;

const CONSIGNE_LECTEUR = `─── DROITS ───
Ton interlocuteur est un admin en lecture seule : tu ne peux faire aucune action. S'il en demande une, dis-lui qu'elle est réservée à un admin complet.`;

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const complet = estAdminComplet(session);

  try {
    const { messages } = schema.parse(await req.json());
    const confirmations: { id: string; message: string }[] = [];

    const executer: ToolExecutor = async (nom, args, tenantId) => {
      if (!estActionAdmin(nom)) return executerLecture(nom, args, tenantId);
      if (!complet) return { succes: false, resultat: "Action réservée à un admin complet." };
      if (args.boutique_id && !(await prisma.tenant.findUnique({ where: { id: args.boutique_id }, select: { id: true } }))) {
        return { succes: false, resultat: "Boutique introuvable : utilise chercher_boutiques pour obtenir son id." };
      }
      const message = await decrireAction(nom, args);
      const action = await prisma.adminAxiaAction.create({ data: { adminId: session.userId, outil: nom, args, message } });
      confirmations.push({ id: action.id, message });
      return { succes: true, resultat: "EN ATTENTE D'ACCORD : rien n'est fait tant que l'admin n'a pas cliqué sur « Autoriser »." };
    };

    const outils = complet ? [...OUTILS_LECTURE, ...OUTILS_ACTION.map(({ libelle: _, ...o }) => o)] : OUTILS_LECTURE;
    const prompt = `${PROMPT}\n\n${complet ? CONSIGNE_ACTIONS : CONSIGNE_LECTEUR}`;
    const result = await runAgent(prompt, messages, outils, await getPlatformTenantId(), executer, 5);
    return NextResponse.json({ reponse: result.reponse, confirmations });
  } catch (err: any) {
    console.error("[axia-admin]", err?.message);
    return NextResponse.json({ reponse: "Désolée, je rencontre une difficulté technique. Réessaie dans un instant.", confirmations: [] });
  }
}
