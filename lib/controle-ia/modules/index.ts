// Registre des modules spécialisés d'AXSO CONTROL. Ajouter un module = l'importer ici.
import type { ModuleIA } from "../types";
import { MODULE as commerce } from "./commerce";
import { MODULE as marche } from "./marche";
import { MODULE as creatif } from "./creatif";
import { MODULE as automatisation } from "./automatisation";
import { MODULE as objectifs } from "./objectifs";
import { MODULE as builder } from "./builder";

export const MODULES_IA: ModuleIA[] = [commerce, marche, creatif, automatisation, objectifs, builder];
