// Pixels publicitaires : UN seul identifiant par plateforme et par boutique
// (jamais une liste) — format attendu de chaque ID, vérifié par la page
// Connecteurs et par l'API (/api/tenants).
export const FORMAT_PIXEL = {
  metaPixelId: /^\d{10,20}$/,
  tiktokPixelId: /^[A-Z0-9]{10,30}$/i,
  snapPixelId: /^[0-9a-f-]{20,40}$/i,
  gtmId: /^GTM-[A-Z0-9]{4,12}$/i,
} as const;
