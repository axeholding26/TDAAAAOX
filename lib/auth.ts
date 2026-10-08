// Configuration NextAuth.js v5 pour Axso
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";
import { z } from "zod";
import { verifierCode } from "@/lib/two-factor";
import { hasResend } from "@/lib/email";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  code: z.string().optional(),
});

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/connexion",
    error: "/connexion",
  },
  providers: [
    Credentials({
      name: "Identifiants",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
        code: { label: "Code", type: "text" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });

        if (!user || !user.password) return null;

        const passwordOk = await compare(parsed.data.password, user.password);
        if (!passwordOk) return null;

        // Membre d'équipe suspendu de TOUTES ses boutiques : accès refusé dès
        // la connexion. Suspendu d'une seule boutique => il se connecte, et
        // permissionsSession lui refuse juste celle-là.
        if (user.role === "membre_equipe") {
          const membres = await prisma.membreEquipe.findMany({ where: { userId: user.id }, select: { statut: true } });
          if (membres.length && membres.every(m => m.statut === "suspendu")) return null;
        }

        // 2FA active uniquement si Resend est configuré (sinon le code n'a
        // jamais pu être envoyé — voir /api/auth/2fa/demander).
        if (hasResend()) {
          if (!parsed.data.code) return null;
          const codeOk = await verifierCode(user.email!, parsed.data.code);
          if (!codeOk) return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          tenantId: user.tenantId,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.tenantId = (user as any).tenantId;
        token.role = (user as any).role;
      }
      // « Mon profil » (/api/compte → unstable_update) : seul le nom, déjà
      // enregistré en base, est repris — jamais la boutique ni le rôle. La photo
      // reste hors du cookie (une image importée dépasserait sa taille maximale).
      if (trigger === "update" && typeof session?.name === "string") token.name = session.name;
      // Changement de boutique active (multi-boutique Palier 2) : le cookie
      // de session est réécrit directement par /api/boutiques/switch (même
      // encode/decode qu'ici), pas via ce callback — voir ce fichier pour le
      // détail et la vérification de propriété.
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        // Un livreur créé par un marchand a User.tenantId renseigné : sans ce garde,
        // toutes les routes marchand qui ne vérifient que tenantId (commandes, export…)
        // lui seraient ouvertes. Son espace n'utilise jamais tenantId de session.
        (session.user as any).tenantId = token.role === "livreur" ? null : token.tenantId;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
});
