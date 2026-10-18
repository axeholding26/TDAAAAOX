// Libellés et couleurs des statuts du studio (lib/academie/regles.ts : STATUTS).
export const STATUT_STUDIO: Record<string, { label: string; couleur: string; fond: string }> = {
  brouillon: { label: "Brouillon", couleur: "#6B7280", fond: "#F3F4F6" },
  en_generation: { label: "En génération", couleur: "#2563EB", fond: "#EFF6FF" },
  a_verifier: { label: "À vérifier", couleur: "#D97706", fond: "#FFFBEB" },
  valide: { label: "Validé", couleur: "#0D9488", fond: "#F0FDFA" },
  publie: { label: "Publié", couleur: "#16A34A", fond: "#ECFDF5" },
  archive: { label: "Archivé", couleur: "#9CA3AF", fond: "#F9FAFB" },
};
