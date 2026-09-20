// Client Redis Upstash pour le cache Axso
import { Redis } from "@upstash/redis";

// Initialisation conditionnelle (pas d'erreur si non configuré)
function getRedisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  return new Redis({ url, token });
}

const redis = getRedisClient();

// Cache générique avec TTL
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    return await redis.get<T>(key);
  } catch {
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSecondes: number = 300
): Promise<void> {
  if (!redis) return;
  try {
    await redis.setex(key, ttlSecondes, JSON.stringify(value));
  } catch {
    // Cache non critique, on ignore les erreurs
  }
}

export async function cacheDel(key: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(key);
  } catch {}
}

// Clés de cache standardisées
export const CACHE_KEYS = {
  tenant: (slug: string) => `tenant:${slug}`,
  produits: (tenantId: string) => `produits:${tenantId}`,
  produit: (id: string) => `produit:${id}`,
  analytics: (tenantId: string, periode: string) =>
    `analytics:${tenantId}:${periode}`,
};
