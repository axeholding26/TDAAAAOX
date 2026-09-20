// Registre local des affiliations rejointes par ce visiteur — aucun compte
// AXSO n'existe pour un affilié individuel (portail self-service par token,
// cf. app/api/affilie/[token]/route.ts). On garde donc la liste de ses
// portails dans le navigateur pour lui offrir une vue agrégée multi-marchands
// sans construire un système de comptes séparé.
const STORAGE_KEY = "axso-mes-affiliations";

export interface AffiliationLocale {
  portalToken: string;
  nomBoutique: string;
  logoUrl?: string | null;
  nomProgramme: string;
}

export function listerAffiliationsLocales(): AffiliationLocale[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function enregistrerAffiliationLocale(entry: AffiliationLocale): void {
  if (typeof window === "undefined") return;
  try {
    const existantes = listerAffiliationsLocales();
    if (existantes.some((a) => a.portalToken === entry.portalToken)) return;
    const maj = [...existantes, entry];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(maj));
  } catch {
    // stockage indisponible (navigation privée, quota...) — dégrade sans bloquer
  }
}

export function retirerAffiliationLocale(portalToken: string): void {
  if (typeof window === "undefined") return;
  try {
    const maj = listerAffiliationsLocales().filter((a) => a.portalToken !== portalToken);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(maj));
  } catch {
    // ignore
  }
}

// Extrait un token depuis soit un token brut, soit une URL de portail collée
// par l'utilisateur (ex: https://axso.vercel.app/affilie/abc123).
export function extraireTokenPortail(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/\/affilie\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) return trimmed;
  return null;
}

// ─── Profil affilié local ───────────────────────────────────────────────────
// Nom/email/téléphone saisis une seule fois (via le marketplace ou le premier
// formulaire de candidature), réutilisés pour rejoindre n'importe quel autre
// programme en un clic — sans jamais redemander les mêmes infos.
const PROFIL_KEY = "axso-profil-affilie";

export interface ProfilAffilie {
  nom: string;
  email: string;
  telephone?: string;
}

export function lireProfilAffilieLocal(): ProfilAffilie | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PROFIL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.nom && parsed?.email ? parsed : null;
  } catch {
    return null;
  }
}

export function sauverProfilAffilieLocal(profil: ProfilAffilie): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROFIL_KEY, JSON.stringify(profil));
  } catch {
    // stockage indisponible — dégrade sans bloquer
  }
}
