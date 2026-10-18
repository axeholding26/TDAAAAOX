// Téléchargement d'une adresse distante protégé contre la SSRF : https public uniquement, IP
// vérifiée au moment de la connexion, redirections revérifiées, taille et délai bornés.
// Partagé par l'import des créations IA (pipeline.ts) et la médiathèque (lib/controle-ia).
import { lookup as dnsLookup } from "dns";
import https from "https";
import { ErreurImport, ipInterdite, urlAcceptee } from "./regles";

export const DELAI_TELECHARGEMENT = 25_000;
const REDIRECTIONS_MAX = 3;

// ─── Téléchargement protégé (SSRF) ───────────────────────────────────────────
/**
 * Résolution DNS vérifiée AU MOMENT de la connexion (pas de fenêtre entre contrôle et
 * connexion, donc pas de « DNS rebinding ») : une seule adresse interdite et tout est refusé.
 */
const lookupSur: typeof dnsLookup = ((host: string, options: any, cb: any) => {
  const o = typeof options === "function" ? {} : options ?? {};
  const rappel = typeof options === "function" ? options : cb;
  dnsLookup(host, { ...o, all: true }, (err, adresses: any[]) => {
    if (err) return rappel(err);
    if (!adresses.length || adresses.some((a) => ipInterdite(a.address))) return rappel(new ErreurImport("Adresse source refusée (réseau privé ou interne)."));
    if (o.all) return rappel(null, adresses);
    rappel(null, adresses[0].address, adresses[0].family);
  });
}) as any;

export interface Telecharge { donnees: Buffer; nom?: string; mime?: string }

/** GET https borné (taille, délai, redirections re-vérifiées à chaque saut), vers des adresses publiques seulement. */
/** `entetes` (ex. clé d'un moteur) : jamais renvoyés à un autre hôte après une redirection. */
export function telechargerSur(brut: string, max: number, delai = DELAI_TELECHARGEMENT, sauts = 0, entetes: Record<string, string> = {}): Promise<Telecharge> {
  const u = urlAcceptee(brut);
  if (!u) return Promise.reject(new ErreurImport("Adresse refusée : https public uniquement (ni IP privée, ni localhost, ni identifiants)."));
  return new Promise((ok, ko) => {
    const req = https.get(u, { lookup: lookupSur, headers: { "user-agent": "AxsoImport/1.0", accept: "*/*", ...entetes }, timeout: delai }, (res) => {
      const code = res.statusCode ?? 0;
      if (code >= 300 && code < 400 && res.headers.location) {
        res.resume();
        if (sauts >= REDIRECTIONS_MAX) return ko(new ErreurImport("Trop de redirections."));
        const suivant = new URL(res.headers.location, u);
        return telechargerSur(suivant.toString(), max, delai, sauts + 1, suivant.host === u.host ? entetes : {}).then(ok, ko);
      }
      if (code !== 200) {
        res.resume();
        // 404 / 410 / 403 : lien expiré ou privé, inutile de réessayer tel quel.
        return ko(new ErreurImport(`Adresse source inaccessible (HTTP ${code})${code === 404 || code === 410 ? " : lien expiré ou supprimé" : ""}.`, code >= 500 || code === 429));
      }
      if (Number(res.headers["content-length"] ?? 0) > max) { res.destroy(); return ko(new ErreurImport(`Fichier trop volumineux (max ${Math.round(max / 1048576)} Mo).`)); }
      const morceaux: Buffer[] = [];
      let total = 0;
      res.on("data", (m: Buffer) => {
        total += m.length;
        if (total > max) { res.destroy(); ko(new ErreurImport(`Fichier trop volumineux (max ${Math.round(max / 1048576)} Mo).`)); }
        else morceaux.push(m);
      });
      res.on("end", () => {
        const dispo = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(String(res.headers["content-disposition"] ?? ""))?.[1];
        const nom = dispo ? decodeURIComponent(dispo) : decodeURIComponent(u.pathname.split("/").pop() ?? "");
        ok({ donnees: Buffer.concat(morceaux), nom: nom || undefined, mime: String(res.headers["content-type"] ?? "").split(";")[0].trim() || undefined });
      });
      res.on("error", () => ko(new ErreurImport("Téléchargement interrompu.", true)));
    });
    const minuteur = setTimeout(() => req.destroy(new ErreurImport("Délai de téléchargement dépassé.", true)), delai);
    req.on("close", () => clearTimeout(minuteur));
    req.on("timeout", () => req.destroy(new ErreurImport("Délai de téléchargement dépassé.", true)));
    req.on("error", (e) => ko(e instanceof ErreurImport ? e : new ErreurImport("Adresse source injoignable.", true)));
  });
}
