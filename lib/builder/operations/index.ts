// Registre des opérations pures du Builder. Ajouter un fichier d'opérations = l'importer ici.
// Chaque opération devient aussi un outil MCP avancé (lib/controle-ia/modules/builder).
import type { OperationBuilder } from "../types";
import { OPERATIONS as design } from "./design";
import { OPERATIONS as structure } from "./structure";
import { OPERATIONS as navigation } from "./navigation";
import { OPERATIONS as seo } from "./seo";

const LISTES: OperationBuilder[][] = [design, structure, navigation, seo];

export const OPERATIONS: OperationBuilder[] = LISTES.flat();
export const OPERATIONS_PAR_NOM = new Map(OPERATIONS.map((o) => [o.nom, o]));
