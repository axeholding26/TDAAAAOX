// Diagnostic temporaire : état du themeConfig / builderTree des boutiques.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL || "postgresql://postgres:Admin@localhost:5432/axso" }),
} as any);

function compteNodes(nodes: any[]): { total: number; parType: Record<string, number> } {
  const parType: Record<string, number> = {};
  let total = 0;
  const walk = (list: any[]) => {
    for (const n of list || []) {
      total++;
      parType[n.type] = (parType[n.type] || 0) + 1;
      if (n.children) walk(n.children);
    }
  };
  walk(nodes);
  return { total, parType };
}

async function main() {
  const tenants = await prisma.tenant.findMany({
    select: { id: true, slug: true, nomBoutique: true, themeId: true, themeConfig: true, statut: true },
    orderBy: { createdAt: "asc" },
  });
  for (const t of tenants) {
    const cfg = (t.themeConfig || {}) as any;
    const tree = cfg.builderTree || [];
    const { total, parType } = compteNodes(tree);
    console.log("────────────────────────────────────────────────");
    console.log(`${t.nomBoutique}  (${t.slug}) statut=${t.statut}`);
    console.log(`  themeId            : ${t.themeId}`);
    console.log(`  clés themeConfig   : ${Object.keys(cfg).join(", ")}`);
    console.log(`  builderTree        : ${total} noeud(s)  ${JSON.stringify(parType)}`);
    console.log(`  customSections     : ${(cfg.customSections || []).length}`);
    console.log(`  sectionOrder       : ${JSON.stringify(cfg.sectionOrder || null)}`);
    console.log(`  builderHtml        : ${cfg.builderHtml ? cfg.builderHtml.length + " car." : "absent"}`);
    console.log(`  sectionSousBlocs   : ${Object.keys(cfg.sectionSousBlocs || {}).join(", ") || "aucun"}`);
  }
  console.log("────────────────────────────────────────────────");
}

main().catch(e => { console.error("ECHEC:", e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
