import { NextResponse } from "next/server";

// Ancienne API de progression : elle acceptait n'importe quel couple commande + e-mail
// (sans vérifier le paiement) et exposait la progression de tout e-mail. Remplacée par
// /api/apprenant/[token]/lecons/[leconId] (jeton d'accès + commande payée + leçon ouverte).
const parti = () => NextResponse.json({ error: "API remplacée par /api/apprenant/[token]" }, { status: 410 });
export const GET = parti;
export const POST = parti;
