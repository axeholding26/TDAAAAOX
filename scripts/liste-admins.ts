// Liste les comptes ayant accès au back-office plateforme (/admin).
// Usage : npx tsx scripts/liste-admins.ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString =
  process.env.DATABASE_URL || "postgresql://postgres:Admin@localhost:5432/axso";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) } as any);

async function main() {
  const admins = await prisma.user.findMany({
    where: { role: { in: ["admin", "admin_lecteur"] } },
    select: { email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  if (admins.length === 0) {
    console.log("\nAucun compte admin en base.\n");
  } else {
    console.log(`\n${admins.length} compte(s) avec accès /admin :\n`);
    for (const a of admins) {
      console.log(`- ${a.email}  |  role=${a.role}  |  ${a.name ?? "sans nom"}`);
    }
    console.log("");
  }

  // Compte visé par la demande d'accès — affiché pour comparaison.
  const cible = await prisma.user.findUnique({
    where: { email: "nathan.pichele8456@gmail.com" },
    select: { email: true, role: true, tenantId: true },
  });
  console.log("Compte cible :", cible
    ? `${cible.email} | role=${cible.role} | tenant=${cible.tenantId}`
    : "introuvable");
  console.log("");
}

main()
  .catch(e => { console.error("ÉCHEC :", e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
