// Constantes et types du système de permissions équipe — CLIENT-SAFE
// (aucun import de Prisma ici). Les fonctions serveur qui lisent la base de
// données (permissionsSession, estCaissierPur, requireNiveau) vivent dans
// lib/permissions-server.ts pour ne jamais faire fuiter le driver Postgres
// dans un bundle client (une page "use client" qui importerait quoi que ce
// soit depuis un fichier qui importe prisma casse le build Next.js — voir
// l'erreur "Module not found: net/tls" rencontrée en important MODULES
// depuis un fichier qui importait aussi prisma).

export const MODULES = [
  "commandes", "produits", "pos", "clients",
  "marketing", "finance", "equipe", "parametres", "boutique",
] as const;
export type ModuleKey = typeof MODULES[number];

export type Niveau = "aucun" | "lecture" | "ecriture";

export type GrillePermissions = Record<ModuleKey, Niveau>;

export const TOUT_ECRITURE: GrillePermissions = {
  commandes: "ecriture", produits: "ecriture", pos: "ecriture", clients: "ecriture",
  marketing: "ecriture", finance: "ecriture", equipe: "ecriture", parametres: "ecriture", boutique: "ecriture",
};

export const ROLE_PRESETS: Record<string, GrillePermissions> = {
  proprietaire: TOUT_ECRITURE,
  gerant: {
    commandes: "ecriture", produits: "ecriture", pos: "ecriture", clients: "ecriture",
    marketing: "ecriture", finance: "lecture", equipe: "aucun", parametres: "lecture", boutique: "ecriture",
  },
  caissier: {
    commandes: "lecture", produits: "lecture", pos: "ecriture", clients: "lecture",
    marketing: "aucun", finance: "aucun", equipe: "aucun", parametres: "aucun", boutique: "aucun",
  },
  comptable: {
    commandes: "lecture", produits: "lecture", pos: "lecture", clients: "lecture",
    marketing: "aucun", finance: "ecriture", equipe: "aucun", parametres: "aucun", boutique: "aucun",
  },
  lecture: {
    commandes: "lecture", produits: "lecture", pos: "lecture", clients: "lecture",
    marketing: "lecture", finance: "aucun", equipe: "aucun", parametres: "aucun", boutique: "lecture",
  },
};

export const ROLE_LABELS: Record<string, string> = {
  proprietaire: "Propriétaire",
  gerant: "Gérant",
  caissier: "Caissier",
  comptable: "Comptable",
  lecture: "Lecture seule",
  personnalise: "Personnalisé",
};

export function grillePourMembre(membre: { role: string; permissions: unknown }): GrillePermissions {
  if (membre.role === "personnalise" && membre.permissions && typeof membre.permissions === "object") {
    const custom = membre.permissions as Partial<GrillePermissions>;
    const grille = {} as GrillePermissions;
    for (const m of MODULES) grille[m] = custom[m] ?? "aucun";
    return grille;
  }
  return ROLE_PRESETS[membre.role] ?? ROLE_PRESETS.lecture;
}
