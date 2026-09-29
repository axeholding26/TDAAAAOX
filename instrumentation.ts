// Exécuté une fois au démarrage de chaque instance serveur (Next.js).
// Crée les comptes administrateurs de la plateforme en production s'ils
// n'existent pas encore. Jamais d'écrasement : un mot de passe changé
// ensuite n'est pas réinitialisé au redémarrage. Mots de passe stockés
// uniquement sous forme de hash bcrypt.
const ADMINS = [
  { name: "Arthur", email: "arthurkira00@gmail.com", password: "$2b$10$RY12EJk/Haoog5uB/UkkUuKlSaFZtb79EOgC/3vJShiygPI4Xnd7m" },
  { name: "Max", email: "kamenimax10@gmail.com", password: "$2b$10$09EWJ3h/3jWm5y3RePAjcOKimu3I9NpQn8uSLHHtc9SJTJQlyPbYK" },
];

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;
  try {
    const { prisma } = await import("./lib/prisma");
    for (const a of ADMINS) {
      const existant = await prisma.user.findUnique({ where: { email: a.email }, select: { role: true } });
      if (!existant) await prisma.user.create({ data: { ...a, role: "admin", tenantId: null } });
      else if (existant.role !== "admin") console.warn(`[admins] ${a.email} existe déjà avec le rôle « ${existant.role} » — non modifié.`);
    }
  } catch (e) {
    // Base injoignable : ne jamais bloquer le démarrage du serveur.
    console.error("[admins] création des comptes admin impossible", e);
  }
}
