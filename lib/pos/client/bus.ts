// Bus de scans du navigateur — NAVIGATEUR uniquement.
//
// Toutes les sources de lecture (caméra, scanner USB / Bluetooth en mode
// clavier, téléphone appairé via le flux temps réel) ÉMETTENT ici ; l'écran
// actif (caisse, inventaire, réception, transfert, fiche…) ÉCOUTE et décide
// quoi faire du code selon son contexte. Les sources ne connaissent pas les
// écrans, les écrans ne connaissent pas les sources.
//
// Dédoublonnage : un même `scanId` n'est livré qu'une fois (le téléphone peut
// renvoyer un scan après une coupure ; le flux peut le rejouer).
import type { ContexteScan, SourceScan } from "../types";

export type ScanEmis = {
  /** Code lu, tel quel. */
  code: string;
  source: SourceScan;
  /** Identifiant unique du scan (crypto.randomUUID côté source) — clé d'idempotence. */
  scanId: string;
  /** Contexte choisi sur l'appareil qui a lu (téléphone), si la source en impose un. */
  contexte?: ContexteScan;
  appareilId?: string;
};

type Ecouteur = (scan: ScanEmis) => void;

const ecouteurs = new Set<Ecouteur>();
// ponytail: mémoire bornée aux 200 derniers scans ; suffisant pour écarter les rejeux d'une reconnexion.
const dejaVus: string[] = [];

/** Publie un scan vers les écrans à l'écoute. Rend false si ce scanId avait déjà été livré. */
export function emettreScan(scan: ScanEmis): boolean {
  if (!scan.code?.trim() || dejaVus.includes(scan.scanId)) return false;
  dejaVus.push(scan.scanId);
  if (dejaVus.length > 200) dejaVus.shift();
  const propre = { ...scan, code: scan.code.trim() };
  for (const ecouteur of [...ecouteurs]) {
    try { ecouteur(propre); } catch (e) { console.error("[pos/bus]", e); }
  }
  return true;
}

/** S'abonne aux scans ; rend la fonction de désabonnement (à rendre par useEffect). */
export function surScan(cb: Ecouteur): () => void {
  ecouteurs.add(cb);
  return () => { ecouteurs.delete(cb); };
}

/** Identifiant de scan pour une source locale (caméra, clavier). */
export function nouveauScanId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
