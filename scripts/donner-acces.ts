// ─────────────────────────────────────────────────────────────────────────────
// Script d'octroi d'accès complet pour un compte de TEST.
//
// Usage :
//   npx tsx scripts/donner-acces.ts <email> [jours] [--admin]
//
//   <email>   email du compte à débloquer (défaut : nathan.pichele8456@gmail.com)
//   [jours]   durée de validité du plan en jours (défaut : 3650 ≈ 10 ans)
//   --admin   ajoute le rôle plateforme "admin" (back-office /admin)
//
// Ce que fait le script :
//   1. Retrouve l'utilisateur par email.
//   2. Recense TOUTES ses boutiques (User.tenantId + ProprietaireBoutique).
//   3. Passe chaque boutique au palier 2 (« Illimité ») — supprime donc le
//      quota de 30 commandes/mois et débloque : analytics avancés + temps
//      réel, sourcing dropshipping mondial, multi-boutique, outils AXIA IA
//      avancés (tier palier1/palier2), marketing, agents, automatisations.
//   4. (option --admin) Passe le rôle du compte à "admin".
//
// Aucune donnée métier n'est créée ou supprimée : seuls planType,
// planExpiresAt et éventuellement role sont modifiés.
// ─────────────────────────────────────────────────────────────────────────────
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const argv = process.argv.slice(2);
const email = argv.find(a => !a.startsWith("--") && a.includes("@"))
  ?? "nathan.pichele8456@gmail.com";
const jours = Number(argv.find(a => /^\d+$/.test(a)) ?? 3650);
const avecAdmin = argv.includes("--admin");

const connectionString =
  process.env.DATABASE_URL || "postgresql://postgres:Admin@localhost:5432/axso";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) } as any);

async function main() {
  if (!Number.isFinite(jours) || jours <= 0) {
    throw new Error(`Durée invalide : "${jours}" (attendu : un nombre de jours > 0).`);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, role: true, tenantId: true },
  });

  if (!user) {
    // Message volontairement explicite : le compte n'existe pas encore en base.
    throw new Error(
      `Aucun utilisateur avec l'email "${email}". ` +
      `Créez d'abord le compte via /inscription puis relancez ce script.`,
    );
  }

  // Toutes les boutiques accessibles : la boutique active + celles possédées.
  const liens = await prisma.proprietaireBoutique.findMany({
    where: { userId: user.id },
    select: { tenantId: true },
  });
  const tenantIds = Array.from(
    new Set([user.tenantId, ...liens.map(l => l.tenantId)].filter(Boolean) as string[]),
  );

  if (tenantIds.length === 0) {
    throw new Error(
      `Le compte "${email}" n'est rattaché à aucune boutique (tenantId vide).`,
    );
  }

  const planExpiresAt = new Date(Date.now() + jours * 24 * 3600 * 1000);

  const { count } = await prisma.tenant.updateMany({
    where: { id: { in: tenantIds } },
    data: { planType: "palier2", planExpiresAt, planPendingRef: null },
  });

  let roleFinal = user.role;
  if (avecAdmin && user.role !== "admin") {
    const maj = await prisma.user.update({
      where: { id: user.id },
      data: { role: "admin" },
      select: { role: true },
    });
    roleFinal = maj.role;
  }

  console.log("");
  console.log("ACCÈS ACCORDÉ");
  console.log("──────────────────────────────────────────────");
  console.log(`Compte          : ${user.email} (${user.name ?? "sans nom"})`);
  console.log(`Boutiques       : ${count} → palier2 « Illimité »`);
  console.log(`Expire le       : ${planExpiresAt.toLocaleDateString("fr-FR")} (${jours} j)`);
  console.log(`Rôle plateforme : ${roleFinal}`);
  if (roleFinal === "admin") {
    console.log("                  (reconnexion requise — le rôle est stocké dans le JWT)");
  }
  console.log("");
}

main()
  .catch(err => {
    console.error("\nÉCHEC : " + (err instanceof Error ? err.message : String(err)) + "\n");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
