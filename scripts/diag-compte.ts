// Diagnostic ciblé : compte connecté → tenant → nature du rendu storefront.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL || "postgresql://postgres:Admin@localhost:5432/axso" }),
} as any);

async function main() {
  const users = await prisma.user.findMany({
    select: { email: true, role: true, tenantId: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  console.log("=== COMPTES ===");
  for (const u of users) console.log(`- ${u.email} role=${u.role} tenant=${u.tenantId}`);

  console.log("\n=== TENANT DU COMPTE DEMANDÉ ===");
  const u = await prisma.user.findUnique({ where: { email: "nathan.pichele8456@gmail.com" }, select: { tenantId: true } });
  if (!u?.tenantId) { console.log("pas de tenant"); return; }
  const t = await prisma.tenant.findUnique({ where: { id: u.tenantId } });
  if (!t) { console.log("tenant introuvable"); return; }
  const cfg = (t.themeConfig || {}) as any;
  console.log(`boutique : ${t.nomBoutique} (${t.slug}) themeId=${t.themeId}`);
  console.log(`builderTree      : ${JSON.stringify((cfg.builderTree || []).map((n: any) => n.type))}`);
  console.log(`builderHtml      : ${cfg.builderHtml ? "présent (" + cfg.builderHtml.length + " car.)" : "absent"}`);
  console.log(`customSections   : ${(cfg.customSections || []).map((s: any) => `${s.type}#${s.id}`).join(", ")}`);
  console.log(`sectionOrder     : ${JSON.stringify(cfg.sectionOrder)}`);
  const theme = await prisma.theme.findUnique({ where: { id: t.themeId }, select: { id: true, slug: true } }).catch(() => null);
  console.log(`thème en base    : ${JSON.stringify(theme)}`);
}

main().catch(e => { console.error("ECHEC:", e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
