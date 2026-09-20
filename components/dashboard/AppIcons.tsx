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

function makeId() {
  return Math.random().toString(36).slice(2);
}

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

// ─── Boutique ─────────────────────────────────────────────────────────────────
export function IconBoutique({ size = 32 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="gBout" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F5A623"/>
          <stop offset="100%" stopColor="#C2790A"/>
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#gBout)"/>
      {/* Storefront */}
      <rect x="6" y="14" width="20" height="12" rx="2" fill="white" opacity="0.85"/>
      <path d="M6 14 L8 8 H24 L26 14 Z" fill="white" opacity="0.5"/>
      <rect x="13" y="18" width="6" height="8" rx="1.5" fill="#F5A623" opacity="0.9"/>
      <rect x="8" y="18" width="4" height="4" rx="1" fill="#F5A623" opacity="0.6"/>
      <rect x="20" y="18" width="4" height="4" rx="1" fill="#F5A623" opacity="0.6"/>
      <rect width="32" height="14" rx="8" fill="white" opacity="0.07"/>
    </svg>
  );
}

// ─── Constructeur / Builder ───────────────────────────────────────────────────
export function IconBuilder({ size = 32 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="gBuild" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#333333"/>
          <stop offset="100%" stopColor="#111111"/>
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#gBuild)"/>
      {/* Baguette magique */}
      <line x1="9" y1="23" x2="21" y2="11" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      <rect x="19.5" y="8" width="5.5" height="5.5" rx="1.5" fill="white" opacity="0.9" transform="rotate(45 22.25 10.75)"/>
      {/* Étoiles */}
      <circle cx="8" cy="10" r="1.2" fill="white" opacity="0.8"/>
      <circle cx="12" cy="7" r="0.9" fill="white" opacity="0.6"/>
      <circle cx="24" cy="23" r="1.2" fill="white" opacity="0.7"/>
      <circle cx="26" cy="18" r="0.8" fill="white" opacity="0.5"/>
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

// ─── Sourcing / Globe ─────────────────────────────────────────────────────────
export function IconSourcing({ size = 32 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="gSrc" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#333333"/>
          <stop offset="100%" stopColor="#111111"/>
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#gSrc)"/>
      {/* Globe */}
      <circle cx="16" cy="16" r="8.5" stroke="white" strokeWidth="1.5" fill="white" fillOpacity="0.1"/>
      <ellipse cx="16" cy="16" rx="4.5" ry="8.5" stroke="white" strokeWidth="1" fill="none" opacity="0.6"/>
      <line x1="7.5" y1="16" x2="24.5" y2="16" stroke="white" strokeWidth="1" opacity="0.6"/>
      <line x1="9" y1="11.5" x2="23" y2="11.5" stroke="white" strokeWidth="0.8" opacity="0.4"/>
      <line x1="9" y1="20.5" x2="23" y2="20.5" stroke="white" strokeWidth="0.8" opacity="0.4"/>
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

// ─── Clients ─────────────────────────────────────────────────────────────────
export function IconClients({ size = 32 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="gCli" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#333333"/>
          <stop offset="100%" stopColor="#111111"/>
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#gCli)"/>
      {/* 2 personnes */}
      <circle cx="12" cy="12" r="3.5" fill="white" opacity="0.9"/>
      <path d="M5 26 C5 21 8.5 18 12 18 C15.5 18 19 21 19 26" fill="white" opacity="0.7"/>
      <circle cx="21" cy="12" r="3" fill="white" opacity="0.6"/>
      <path d="M18 26 C18.5 22 21 19.5 24 19 C26 18.8 28 20 28 23 L28 26" fill="white" opacity="0.45"/>
      <rect width="32" height="14" rx="8" fill="white" opacity="0.06"/>
    </svg>
  );
}

// ─── Wallet ───────────────────────────────────────────────────────────────────
export function IconWallet({ size = 32 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="gWlt" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F5A623"/>
          <stop offset="100%" stopColor="#C2790A"/>
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#gWlt)"/>
      {/* Carte + pièce */}
      <rect x="6" y="11" width="20" height="14" rx="3" fill="white" opacity="0.85"/>
      <rect x="6" y="15" width="20" height="3" fill="#F5A623" opacity="0.5"/>
      <circle cx="23" cy="19" r="3.5" fill="#F5A623" stroke="white" strokeWidth="1.5"/>
      <rect width="32" height="14" rx="8" fill="white" opacity="0.07"/>
    </svg>
  );
}

// ─── Revenus / Trending ───────────────────────────────────────────────────────
export function IconRevenus({ size = 32 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="gRev" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#333333"/>
          <stop offset="100%" stopColor="#111111"/>
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#gRev)"/>
      {/* Courbe montante */}
      <path d="M6 22 C9 22 10 15 13 13 C16 11 18 17 21 14 C23 12 25 9 26 8" stroke="white" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.9"/>
      <polyline points="22,8 26,8 26,12" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9"/>
      <rect width="32" height="14" rx="8" fill="white" opacity="0.06"/>
    </svg>
  );
}

// ─── Marketing ───────────────────────────────────────────────────────────────
export function IconMarketing({ size = 32 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="gMkt" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F5A623"/>
          <stop offset="100%" stopColor="#C2790A"/>
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#gMkt)"/>
      {/* Mégaphone */}
      <path d="M8 13 H12 L22 8 L22 24 L12 19 H8 V13 Z" fill="white" opacity="0.9"/>
      <rect x="8" y="19" width="4" height="5" rx="1" fill="white" opacity="0.5"/>
      {/* Ondes */}
      <path d="M24 12 C25.5 13.5 25.5 18.5 24 20" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7"/>
      <path d="M25.5 10 C28 12.5 28 19.5 25.5 22" stroke="white" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.4"/>
      <rect width="32" height="14" rx="8" fill="white" opacity="0.07"/>
    </svg>
  );
}

// ─── Messages / Chat ──────────────────────────────────────────────────────────
export function IconMessages({ size = 32 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="gMsg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#333333"/>
          <stop offset="100%" stopColor="#111111"/>
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#gMsg)"/>
      {/* Bulle principale */}
      <path d="M6 10 H22 C23.1 10 24 10.9 24 12 V20 C24 21.1 23.1 22 22 22 H13 L8 26 V22 H6 C4.9 22 4 21.1 4 20 V12 C4 10.9 4.9 10 6 10 Z" fill="white" opacity="0.85"/>
      {/* Lignes de texte */}
      <line x1="9" y1="15" x2="19" y2="15" stroke="#111111" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="9" y1="18.5" x2="15" y2="18.5" stroke="#111111" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Bulle secondaire */}
      <path d="M20 6 H27 C27.6 6 28 6.4 28 7 V13 C28 13.6 27.6 14 27 14 H25 L23 16 V14 H20 C19.4 14 19 13.6 19 13 V7 C19 6.4 19.4 6 20 6 Z" fill="white" opacity="0.5"/>
      <rect width="32" height="14" rx="8" fill="white" opacity="0.06"/>
    </svg>
  );
}

// ─── Contenus / Studio ───────────────────────────────────────────────────────
export function IconContenus({ size = 32 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="gCnt" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F5A623"/>
          <stop offset="100%" stopColor="#C2790A"/>
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#gCnt)"/>
      {/* Clap board */}
      <rect x="6" y="12" width="20" height="14" rx="2.5" fill="white" opacity="0.85"/>
      <rect x="6" y="8" width="20" height="5.5" rx="2" fill="white" opacity="0.5"/>
      {/* Rayures clap */}
      <line x1="10" y1="8" x2="8" y2="13.5" stroke="#F5A623" strokeWidth="2" strokeLinecap="round"/>
      <line x1="14" y1="8" x2="12" y2="13.5" stroke="#F5A623" strokeWidth="2" strokeLinecap="round"/>
      <line x1="18" y1="8" x2="16" y2="13.5" stroke="#F5A623" strokeWidth="2" strokeLinecap="round"/>
      <line x1="22" y1="8" x2="20" y2="13.5" stroke="#F5A623" strokeWidth="2" strokeLinecap="round"/>
      {/* Play button */}
      <path d="M14 17 L20 20.5 L14 24 Z" fill="#C2790A" opacity="0.7"/>
      <rect width="32" height="14" rx="8" fill="white" opacity="0.06"/>
    </svg>
  );
}

// ─── Livraisons / Truck ───────────────────────────────────────────────────────
export function IconLivraisons({ size = 32 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="gLiv" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F5A623"/>
          <stop offset="100%" stopColor="#C2790A"/>
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#gLiv)"/>
      {/* Camion */}
      <rect x="4" y="14" width="16" height="9" rx="2" fill="white" opacity="0.85"/>
      <path d="M20 17 H26 L28 21 L28 23 H20 V17 Z" fill="white" opacity="0.7"/>
      <rect x="21" y="17.5" width="4" height="4" rx="0.5" fill="#F5A623" opacity="0.5"/>
      {/* Roues */}
      <circle cx="9" cy="24.5" r="2.5" fill="white" opacity="0.9"/>
      <circle cx="9" cy="24.5" r="1" fill="#F5A623"/>
      <circle cx="23" cy="24.5" r="2.5" fill="white" opacity="0.9"/>
      <circle cx="23" cy="24.5" r="1" fill="#F5A623"/>
      <rect width="32" height="14" rx="8" fill="white" opacity="0.07"/>
    </svg>
  );
}

// ─── Analytics / Chart ───────────────────────────────────────────────────────
export function IconAnalytics({ size = 32 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="gAna" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFD280"/>
          <stop offset="100%" stopColor="#111111"/>
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#gAna)"/>
      {/* Barres */}
      <rect x="7" y="20" width="4" height="6" rx="1.5" fill="white" opacity="0.5"/>
      <rect x="14" y="14" width="4" height="12" rx="1.5" fill="white" opacity="0.75"/>
      <rect x="21" y="9" width="4" height="17" rx="1.5" fill="white" opacity="0.95"/>
      {/* Ligne de base */}
      <line x1="5" y1="26" x2="27" y2="26" stroke="white" strokeWidth="1.2" opacity="0.4"/>
      <rect width="32" height="14" rx="8" fill="white" opacity="0.06"/>
    </svg>
  );
}

// ─── Connecteurs / Link ───────────────────────────────────────────────────────
export function IconConnecteurs({ size = 32 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="gCon" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#333333"/>
          <stop offset="100%" stopColor="#111111"/>
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#gCon)"/>
      {/* Chain link */}
      <path d="M13 19 C11 21 8 21 6.5 19.5 C5 18 5 15 7 13 L11 9 C13 7 16 7 17.5 8.5 C19 10 19 13 17 15" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.9"/>
      <path d="M19 13 C21 11 24 11 25.5 12.5 C27 14 27 17 25 19 L21 23 C19 25 16 25 14.5 23.5 C13 22 13 19 15 17" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.65"/>
      <rect width="32" height="14" rx="8" fill="white" opacity="0.06"/>
    </svg>
  );
}

// ─── Abonnement / Crown ───────────────────────────────────────────────────────
export function IconAbonnement({ size = 32 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="gAbo" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F5A623"/>
          <stop offset="100%" stopColor="#C2790A"/>
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#gAbo)"/>
      {/* Couronne */}
      <path d="M6 24 L7 14 L12 19 L16 9 L20 19 L25 14 L26 24 Z" fill="white" opacity="0.9"/>
      <rect x="6" y="24" width="20" height="3" rx="1.5" fill="white" opacity="0.6"/>
      {/* Gemmes */}
      <circle cx="16" cy="13" r="1.5" fill="#F5A623" opacity="0.9"/>
      <circle cx="10" cy="18.5" r="1" fill="#F5A623" opacity="0.7"/>
      <circle cx="22" cy="18.5" r="1" fill="#F5A623" opacity="0.7"/>
      <rect width="32" height="14" rx="8" fill="white" opacity="0.07"/>
    </svg>
  );
}

// ─── Paramètres / Settings ───────────────────────────────────────────────────
export function IconParametres({ size = 32 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="gPrm" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#333333"/>
          <stop offset="100%" stopColor="#111111"/>
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#gPrm)"/>
      {/* Gear */}
      <path d="M16 10 L17.5 7 L14.5 7 L16 10 Z M16 10 C17.1 10 18 10.9 18 12" fill="white" opacity="0" />
      <path fillRule="evenodd" clipRule="evenodd"
        d="M16 12a4 4 0 100 8 4 4 0 000-8zm-6.9 2.5l-1.5-1 1-1.7 1.7.6a6 6 0 011.2-.7l.3-1.8h2l.3 1.8c.4.2.8.4 1.2.7l1.7-.6 1 1.7-1.5 1a6 6 0 010 1.4l1.5 1-1 1.7-1.7-.6a6 6 0 01-1.2.7l-.3 1.8h-2l-.3-1.8a6 6 0 01-1.2-.7l-1.7.6-1-1.7 1.5-1a6 6 0 010-1.4z"
        fill="white" opacity="0.85"/>
      <rect width="32" height="14" rx="8" fill="white" opacity="0.06"/>
    </svg>
  );
}

// ─── Paiements ───────────────────────────────────────────────────────────────
export function IconPaiements({ size = 32 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="gPai" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F5A623"/>
          <stop offset="100%" stopColor="#C2790A"/>
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#gPai)"/>
      <rect x="5" y="10" width="22" height="14" rx="3" fill="white" opacity="0.85"/>
      <rect x="5" y="14.5" width="22" height="4" fill="#F5A623" opacity="0.35"/>
      <rect x="8" y="19" width="5" height="2" rx="1" fill="#C2790A" opacity="0.5"/>
      <rect x="21" y="18.5" width="4" height="3" rx="1" fill="#C2790A" opacity="0.4"/>
      <rect width="32" height="14" rx="8" fill="white" opacity="0.06"/>
    </svg>
  );
}

// ─── Avis / Stars ────────────────────────────────────────────────────────────
export function IconAvis({ size = 32 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="gAvi" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F5A623"/>
          <stop offset="100%" stopColor="#C2790A"/>
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#gAvi)"/>
      <path d="M16 7 L18.2 13.2 H24.8 L19.5 17 L21.7 23.2 L16 19.4 L10.3 23.2 L12.5 17 L7.2 13.2 H13.8 Z"
        fill="white" opacity="0.95"/>
      <rect width="32" height="14" rx="8" fill="white" opacity="0.07"/>
    </svg>
  );
}

// ─── IA / Intelligence ───────────────────────────────────────────────────────
export function IconIA({ size = 32 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="gIA" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#333333"/>
          <stop offset="100%" stopColor="#111111"/>
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#gIA)"/>
      {/* Cerveau stylisé */}
      <path d="M16 8 C11 8 7 11.5 7 16 C7 19 8.5 21.5 11 23 L11 26 H14 L14 24 H18 L18 26 H21 L21 23 C23.5 21.5 25 19 25 16 C25 11.5 21 8 16 8 Z"
        fill="white" opacity="0.85"/>
      <line x1="16" y1="8" x2="16" y2="13" stroke="#111111" strokeWidth="1.5"/>
      <line x1="11" y1="10" x2="14" y2="14" stroke="#111111" strokeWidth="1" opacity="0.6"/>
      <line x1="21" y1="10" x2="18" y2="14" stroke="#111111" strokeWidth="1" opacity="0.6"/>
      <circle cx="16" cy="16" r="2" fill="#111111" opacity="0.7"/>
      <rect width="32" height="14" rx="8" fill="white" opacity="0.07"/>
    </svg>
  );
}

// ─── Thèmes / Palette ────────────────────────────────────────────────────────
export function IconThemes({ size = 32 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="gThm" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F5A623"/>
          <stop offset="100%" stopColor="#C2790A"/>
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#gThm)"/>
      {/* Palette */}
      <path d="M16 7 C11 7 7 11 7 16 C7 18.5 8 20.5 9.5 22 C11 23.5 13 24 14 23.5 C15 23 15 21.5 16 21.5 C20 21.5 25 19 25 16 C25 11 21 7 16 7 Z"
        fill="white" opacity="0.85"/>
      <circle cx="11.5" cy="13.5" r="1.8" fill="#F5A623" opacity="0.7"/>
      <circle cx="16" cy="11" r="1.8" fill="#111111" opacity="0.7"/>
      <circle cx="20.5" cy="13.5" r="1.8" fill="#D4911A" opacity="0.7"/>
      <circle cx="20" cy="18" r="1.8" fill="#666666" opacity="0.7"/>
      <circle cx="13" cy="20" r="1.5" fill="#999999" opacity="0.55"/>
      <rect width="32" height="14" rx="8" fill="white" opacity="0.06"/>
    </svg>
  );
}

// ─── MAGIC IMPORT ────────────────────────────────────────────────────────────
export function IconMagicImport({ size = 32 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="gMagic" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F5A623"/>
          <stop offset="100%" stopColor="#F5A623"/>
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#gMagic)"/>
      {/* Magic wand */}
      <line x1="8" y1="24" x2="19" y2="13" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      {/* Wand tip diamond */}
      <path d="M20 12 L22.5 9.5 L25 12 L22.5 14.5 Z" fill="white" opacity="0.95"/>
      {/* Sparkles */}
      <circle cx="26" cy="7" r="1.8" fill="white" opacity="0.9"/>
      <circle cx="9" cy="10" r="1.2" fill="white" opacity="0.7"/>
      <circle cx="25" cy="21" r="1.2" fill="white" opacity="0.65"/>
      <line x1="26" y1="14" x2="26" y2="18" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
      <line x1="24" y1="16" x2="28" y2="16" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
    </svg>
  );
}

export function IconWhatsApp({ size = 32 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="gWa" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#25D366"/>
          <stop offset="100%" stopColor="#128C7E"/>
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#gWa)"/>
      <path d="M16 6.5C10.75 6.5 6.5 10.75 6.5 16c0 1.7.44 3.3 1.2 4.7L6.5 25.5l4.9-1.18A9.43 9.43 0 0 0 16 25.5c5.25 0 9.5-4.25 9.5-9.5S21.25 6.5 16 6.5Z" fill="white" opacity="0.15"/>
      <path d="M16 7.8c-4.52 0-8.2 3.68-8.2 8.2 0 1.55.43 3 1.18 4.23L8 24.2l4.1-.99A8.16 8.16 0 0 0 16 24.2c4.52 0 8.2-3.68 8.2-8.2 0-4.52-3.68-8.2-8.2-8.2Zm4.13 11.3c-.17.49-1 .93-1.37.97-.35.04-.68.18-2.28-.47-1.93-.78-3.17-2.74-3.27-2.87-.1-.13-.81-1.08-.81-2.06 0-.98.51-1.46.7-1.66.18-.2.4-.25.53-.25h.38c.12 0 .29-.05.45.34.17.4.58 1.4.63 1.5.05.1.08.22.02.35-.06.13-.1.21-.2.32-.1.11-.2.24-.29.32-.1.09-.2.19-.09.38.12.18.52.86 1.12 1.4.77.69 1.42.9 1.62.99.2.1.32.08.43-.05.12-.13.5-.58.63-.78.14-.2.27-.17.46-.1.18.07 1.18.56 1.38.66.2.1.33.14.38.22.05.08.05.46-.12.95Z" fill="white"/>
    </svg>
  );
}
