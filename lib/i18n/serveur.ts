import { cache } from "react";
import { cookies } from "next/headers";
import { creerT, type Dico, type Langue, type Zone, ZONES } from "@/lib/i18n";

export const COOKIE_LANGUE = "langue";

export const getLangue = cache(async (): Promise<Langue> =>
  (await cookies()).get(COOKIE_LANGUE)?.value === "en" ? "en" : "fr");

/** Dictionnaire anglais des zones demandées ({} en français). */
export async function dico(...zones: Zone[]): Promise<Dico> {
  if ((await getLangue()) === "fr") return {};
  const parts = await Promise.all(zones.map(z => import(`./en/${z}.json`).then(m => m.default as Dico)));
  return Object.assign({}, ...parts);
}

/** Fonction de traduction pour les composants serveur : `const t = await getT();` */
export const getT = cache(async () => creerT(await getLangue(), await dico(...ZONES)));
