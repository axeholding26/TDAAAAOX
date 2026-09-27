"use client";

import { useEffect, useState } from "react";

// Catégories de la boutique et options de variantes qu'elles proposent —
// partagé par les formulaires de création et de modification de produit.
export type CategorieBoutique = { id: string; nom: string; options: { nom: string; valeurs: string[] }[] };

const OPTIONS_PAR_DEFAUT = ["Taille", "Couleur", "Matière", "Poids", "Modèle", "Style", "Pack"];

export function useCategoriesBoutique() {
  const [categories, setCategories] = useState<CategorieBoutique[] | null>(null);
  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then((d) => setCategories(d.categories ?? [])).catch(() => setCategories([]));
  }, []);
  return categories;
}

/** Options proposées pour les variantes : celles de la catégorie choisie, sinon la liste générique. */
export function optionsVariantes(categories: CategorieBoutique[] | null, nomCategorie: string) {
  const options = categories?.find((c) => c.nom === nomCategorie)?.options.filter((o) => o.nom) ?? [];
  return options.length
    ? { noms: options.map((o) => o.nom), valeurs: (nom: string) => options.find((o) => o.nom === nom)?.valeurs ?? [] }
    : { noms: OPTIONS_PAR_DEFAUT, valeurs: () => [] as string[] };
}
