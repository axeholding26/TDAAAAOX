// Singleton Prisma Client v7 avec adaptateur pg pour PostgreSQL local
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function creerPrismaClient(): PrismaClient {
  const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://postgres:Admin@localhost:5432/axso";

  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  } as any);
}

export const prisma = globalForPrisma.prisma ?? creerPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
