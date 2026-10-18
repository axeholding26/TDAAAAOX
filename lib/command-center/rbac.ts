// Rôles de l'équipe Axso et sections visibles par rôle. Module pur : utilisé côté
// serveur pour AUTORISER (pages et API) et côté client seulement pour masquer les liens.
// Le rôle "admin" (Super admin) reste le seul à pouvoir déplacer de l'argent ou
// modifier une boutique (estAdminComplet, lib/admin-auth.ts).

export const ROLES_ADMIN = ["admin", "admin_ceo", "admin_finance", "admin_growth", "admin_produit", "admin_support", "admin_operations", "admin_analyste", "admin_lecteur"] as const;
export type RoleAdmin = (typeof ROLES_ADMIN)[number];
export const estRoleAdmin = (r: unknown): r is RoleAdmin => ROLES_ADMIN.includes(r as RoleAdmin);

export const NOM_ROLE: Record<RoleAdmin, string> = {
  admin: "Super admin", admin_ceo: "CEO", admin_finance: "Finance", admin_growth: "Growth", admin_produit: "Produit",
  admin_support: "Support", admin_operations: "Opérations", admin_analyste: "Analyste", admin_lecteur: "Lecture seule",
};

export const SECTIONS = [
  "cc", "croissance", "revenus", "marchands", "commerce", "ia", "marketing", "operations", "paiements", "geographie",
  "produit", "succes", "alertes", "experiences", "rapports", "explorer", "reglages", "audit",
  // Gestion (pages historiques)
  "boutiques", "abonnements", "finances", "axsocial", "livreurs", "fournisseurs", "equipe", "integrations", "avis",
] as const;
export type Section = (typeof SECTIONS)[number];

const ANALYTIQUE: Section[] = ["cc", "croissance", "revenus", "marchands", "commerce", "ia", "marketing", "operations", "paiements", "geographie", "produit", "succes", "alertes", "experiences", "rapports", "explorer"];

const ACCES: Record<RoleAdmin, Section[]> = {
  admin: [...SECTIONS],
  admin_lecteur: [...ANALYTIQUE, "reglages", "audit", "boutiques", "abonnements", "finances", "axsocial", "livreurs", "fournisseurs", "equipe", "avis"],
  admin_ceo: [...ANALYTIQUE, "reglages", "audit", "boutiques", "abonnements", "finances", "avis"],
  admin_analyste: [...ANALYTIQUE, "reglages"],
  admin_finance: ["cc", "revenus", "paiements", "commerce", "geographie", "marchands", "alertes", "rapports", "explorer", "finances", "abonnements", "boutiques"],
  admin_growth: ["cc", "croissance", "revenus", "marchands", "marketing", "geographie", "experiences", "succes", "ia", "produit", "alertes", "rapports", "explorer", "boutiques", "axsocial", "avis"],
  admin_produit: ["cc", "produit", "ia", "croissance", "experiences", "marchands", "alertes", "rapports", "explorer"],
  admin_support: ["cc", "marchands", "succes", "operations", "commerce", "alertes", "boutiques", "livreurs", "avis"],
  admin_operations: ["cc", "operations", "commerce", "paiements", "geographie", "marchands", "alertes", "rapports", "livreurs", "fournisseurs", "boutiques"],
};

export const peutVoir = (role: RoleAdmin, s: Section) => ACCES[role]?.includes(s) ?? false;

/** Section dont relève une page (/admin/revenus#plans → revenus). */
export function sectionDe(chemin: string): Section {
  const seg = chemin.split(/[?#]/)[0].split("/")[2] ?? "";
  const alias: Record<string, Section> = { "": "cc", "succes-client": "succes", experiences: "experiences" };
  return (alias[seg] ?? (SECTIONS.includes(seg as Section) ? seg : "cc")) as Section;
}

/** Actions déclenchables depuis un insight (assigner, ignorer, notifier des marchands). */
export const peutAgir = (role: RoleAdmin) => ["admin", "admin_ceo", "admin_growth", "admin_support", "admin_operations"].includes(role);
/** Modifier seuils, objectifs, pondérations, rapports planifiés. */
export const peutReglerCC = (role: RoleAdmin) => role === "admin" || role === "admin_ceo";
