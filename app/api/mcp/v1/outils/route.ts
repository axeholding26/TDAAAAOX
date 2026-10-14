// Documentation générée des outils MCP d'Axso : nom, description, schéma d'entrée, droits,
// niveau de risque, comportement d'idempotence, erreurs. Publique : aucune donnée de boutique.
import { NextResponse } from "next/server";
import { catalogue } from "@/lib/controle-ia/serveur";

export const GET = () => NextResponse.json({ version: "v1", tools: catalogue() });
