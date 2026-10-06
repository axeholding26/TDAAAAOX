// Dossier de stockage d'une boutique (Vercel Blob) : tout import y est rangé,
// pour que la bibliothèque « Fichiers » liste ce qui appartient à la boutique
// et rien d'autre. Les fichiers importés avant ce rangement restent où ils
// sont : les déplacer changerait leur adresse et casserait les pages en ligne.
export const dossierBoutique = (tenantId: string) => `boutiques/${tenantId}/`;

// Fichiers des produits digitaux : livrés aux acheteurs et gérés depuis le
// produit — jamais listés ni supprimables dans Fichiers (comme Shopify, où ils
// relèvent de l'app Digital Downloads et non de Contenu → Fichiers).
export const SOUS_DOSSIER_DIGITAL = "digitals/";
