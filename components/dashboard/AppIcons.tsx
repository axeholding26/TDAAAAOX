/**
 * App icons — style macOS/iOS squircle
 * Chaque icône = fond gradient + glyphe SVG blanc précis
 */

interface IconProps {
  size?: number;
  className?: string;
}

// ─── Squircle helper (clip-path interne) ─────────────────────────────────────
// On utilise rx/ry élevés sur rect pour simuler le squircle Apple

// ─── AXIA ──────────────────────────────────────────────────────────────────────
export function IconAxia({ size = 32 }: IconProps) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "9999px", overflow: "hidden",
        border: "2px solid white", boxShadow: "0 2px 10px rgba(17,17,17,0.35)",
        flexShrink: 0,
      }}
    >
      <img src="/axia-icon.png" alt="Axia" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
  );
}

// ─── Accueil / Dashboard ──────────────────────────────────────────────────────
export function IconAccueil({ size = 32 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="gHome" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#333333"/>
          <stop offset="100%" stopColor="#111111"/>
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#gHome)"/>
      {/* Grille 2x2 */}
      <rect x="7" y="7" width="7.5" height="7.5" rx="2" fill="white" opacity="0.9"/>
      <rect x="17.5" y="7" width="7.5" height="7.5" rx="2" fill="white" opacity="0.6"/>
      <rect x="7" y="17.5" width="7.5" height="7.5" rx="2" fill="white" opacity="0.6"/>
      <rect x="17.5" y="17.5" width="7.5" height="7.5" rx="2" fill="white" opacity="0.9"/>
      <rect width="32" height="14" rx="8" fill="white" opacity="0.06"/>
    </svg>
  );
}

// ─── Produits ─────────────────────────────────────────────────────────────────
export function IconProduits({ size = 32 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="gProd" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F5A623"/>
          <stop offset="100%" stopColor="#C2790A"/>
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#gProd)"/>
      {/* Boîte 3D */}
      <path d="M16 7 L25 12 L25 22 L16 27 L7 22 L7 12 Z" fill="white" opacity="0.15"/>
      <path d="M16 7 L25 12 L16 17 L7 12 Z" fill="white" opacity="0.85"/>
      <path d="M16 17 L25 12 L25 22 L16 27 Z" fill="white" opacity="0.55"/>
      <path d="M16 17 L7 12 L7 22 L16 27 Z" fill="white" opacity="0.4"/>
      <line x1="16" y1="17" x2="16" y2="27" stroke="white" strokeWidth="0.5" opacity="0.3"/>
      <rect width="32" height="14" rx="8" fill="white" opacity="0.06"/>
    </svg>
  );
}

// ─── Commandes ───────────────────────────────────────────────────────────────
export function IconCommandes({ size = 32 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="gCmd" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F5A623"/>
          <stop offset="100%" stopColor="#C2790A"/>
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#gCmd)"/>
      {/* Sac shopping */}
      <path d="M10 13 H22 L20.5 24 H11.5 Z" fill="white" opacity="0.85"/>
      <path d="M12 13 C12 10 14 8 16 8 C18 8 20 10 20 13" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.9"/>
      <line x1="13.5" y1="17" x2="18.5" y2="17" stroke="#F5A623" strokeWidth="1.5" strokeLinecap="round"/>
      <rect width="32" height="14" rx="8" fill="white" opacity="0.07"/>
    </svg>
  );
}
