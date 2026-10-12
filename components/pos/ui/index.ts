// Kit d'interface de la caisse AXSO POS 2.0 — à importer depuis "@/components/pos/ui".
export { POLICE, COULEURS, TONS, FOCUS, type Ton } from "./tokens";
export { Bouton, BoutonIcone, type BoutonProps, type VarianteBouton, type TailleBouton } from "./Bouton";
export { Champ, Saisie, CLASSE_SAISIE, type ChampProps, type SaisieProps } from "./Champ";
export { Badge, BadgePaiement, BadgeConnexion } from "./Badge";
export { Modale, Tiroir } from "./Surfaces";
export { EtatVide, EtatChargement, EtatErreur, EtatHorsLigne, EtatNonAutorise, EtatConflit, EtatEnAttente, EtatPos } from "./Etats";
