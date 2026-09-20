// Codes à 6 chiffres — double authentification à la connexion et réinitialisation
// de mot de passe. Un seul code actif à la fois par email, usage unique, 10 min.
import { prisma } from "./prisma";
import crypto from "crypto";

const EXPIRATION_MINUTES = 10;

export function genererCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export async function creerCodeVerification(email: string): Promise<string> {
  const code = genererCode();
  const expireAt = new Date(Date.now() + EXPIRATION_MINUTES * 60 * 1000);
  await prisma.codeVerification.deleteMany({ where: { email } });
  await prisma.codeVerification.create({ data: { email, code, expireAt } });
  return code;
}

export async function verifierCode(email: string, code: string): Promise<boolean> {
  const entry = await prisma.codeVerification.findFirst({
    where: { email, code, utilise: false, expireAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!entry) return false;
  await prisma.codeVerification.update({ where: { id: entry.id }, data: { utilise: true } });
  return true;
}
