// Erreurs de la caisse : toujours une phrase qu'un caissier comprend, jamais
// « Error 409 ». `code` sert à l'écran pour choisir l'état à afficher
// (non autorisé, conflit, hors ligne…), `message` est affiché tel quel.
// CLIENT-SAFE : aucun import (la réponse est une `Response` standard, que les
// routes renvoient telle quelle), pour que droits.ts et l'écran de caisse
// puissent lire ce fichier sans embarquer de code serveur.

export class ErreurPos extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
    /** Données utiles à l'écran (stock restant, session concernée…). */
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ErreurPos";
  }
}

/** Raccourcis des refus les plus courants. */
export const erreurs = {
  nonConnecte: () => new ErreurPos("non_connecte", 401, "Votre session a expiré. Reconnectez-vous pour continuer."),
  introuvable: (quoi: string) => new ErreurPos("introuvable", 404, `${quoi} est introuvable dans cette boutique.`),
  invalide: (message: string) => new ErreurPos("invalide", 400, message),
  conflit: (message: string, details?: Record<string, unknown>) => new ErreurPos("conflit", 409, message, details),
};

/**
 * Réponse JSON d'une exception : `{ error, code, details? }`.
 * Garde le message des erreurs métier (ErreurPos, RuptureStock et toute erreur
 * portant un `status`), traduit les erreurs de validation zod, masque le reste.
 */
export function reponseErreurPos(e: unknown): Response {
  if (e instanceof ErreurPos) {
    return Response.json({ error: e.message, code: e.code, ...(e.details ? { details: e.details } : {}) }, { status: e.status });
  }
  const x = e as any;
  if (x?.name === "ZodError") {
    const p = x.issues?.[0];
    const champ = p?.path?.length ? ` (${p.path.join(".")})` : "";
    return Response.json({ error: `Les informations envoyées sont incomplètes ou incorrectes${champ}. ${p?.message ?? ""}`.trim(), code: "invalide" }, { status: 400 });
  }
  if (x instanceof SyntaxError) {
    return Response.json({ error: "La demande envoyée est illisible. Réessayez.", code: "invalide" }, { status: 400 });
  }
  if (typeof x?.status === "number" && x.status >= 400 && x.status < 600 && typeof x?.message === "string") {
    return Response.json({ error: x.message, code: x.status === 409 ? "conflit" : "refuse" }, { status: x.status });
  }
  console.error("[pos]", e);
  return Response.json({ error: "Un problème est survenu de notre côté. Rien n'a été enregistré : réessayez dans un instant.", code: "erreur_serveur" }, { status: 500 });
}
