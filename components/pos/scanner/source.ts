// Scan lu SUR LE POSTE (caméra, scanner USB ou Bluetooth en mode clavier) :
// remis tout de suite aux écrans par le bus local, puis tracé côté serveur
// (ScanPos : appareil, utilisateur, magasin, caisse, session, heure) sans
// attendre la réponse. NAVIGATEUR uniquement.
import { emettreScan, nouveauScanId, type ScanEmis } from "@/lib/pos/client/bus";
import type { ContexteScan } from "@/lib/pos/types";

export type OptionsSource = {
  /** Contexte du scan (défaut : vente). */
  contexte?: ContexteScan;
  /** false = ne pas tracer le scan côté serveur (défaut : tracé). */
  tracer?: boolean;
  /** Caisse de travail, si l'écran en a choisi une (en-tête x-pos-caisse). */
  caisseId?: string | null;
};

/** Émet un scan local sur le bus et le trace. Rend le scan émis. */
export function emettreLocal(code: string, source: "camera" | "clavier", o: OptionsSource = {}): ScanEmis {
  const scan: ScanEmis = { code: code.trim(), source, scanId: nouveauScanId(), contexte: o.contexte ?? "vente" };
  emettreScan(scan);
  if (o.tracer !== false) {
    // La trace ne conditionne rien : hors ligne ou refusée, le scan a déjà été remis à l'écran.
    fetch("/api/pos/scanner/scans", {
      method: "POST", keepalive: true,
      headers: { "Content-Type": "application/json", ...(o.caisseId ? { "x-pos-caisse": o.caisseId } : {}) },
      body: JSON.stringify({ ...scan, scanneAt: new Date().toISOString() }),
    }).catch(() => {});
  }
  return scan;
}
