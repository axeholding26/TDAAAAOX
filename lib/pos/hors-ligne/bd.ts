// Stockage local de la caisse : IndexedDB natif, une base par boutique
// (`axso-pos-<tenantId>`). NAVIGATEUR uniquement.
//
//   catalogue : instantané des articles (clé `id` = produitId) + sa fiche `__meta`
//   clients   : clients vus récemment sur ce poste, champs minimaux
//   panier    : panier en cours (`courant`) et paniers suspendus sur l'appareil
//   file      : mutations en attente — clé auto-incrémentée `ordre` (= ordre
//               d'arrivée), index UNIQUE sur `cle` : la même vente ne peut pas
//               entrer deux fois dans la file.
//
// IndexedDB n'est PAS chiffré : on n'y met que ce que la caisse affiche déjà.
// Le navigateur peut purger ce stockage (iOS : environ 7 jours sans visite pour
// un site non installé) : `demanderPersistance` demande à en être dispensé.
import type { Mutation } from "./file";

export type Magasin = "catalogue" | "clients" | "panier" | "file";

const bases = new Map<string, Promise<IDBDatabase>>();

export function stockageDisponible(): boolean {
  return typeof indexedDB !== "undefined";
}

export function ouvrirBase(tenantId: string): Promise<IDBDatabase> {
  let base = bases.get(tenantId);
  if (!base) {
    base = new Promise<IDBDatabase>((ok, ko) => {
      const demande = indexedDB.open(`axso-pos-${tenantId}`, 1);
      demande.onupgradeneeded = () => {
        const bd = demande.result;
        for (const m of ["catalogue", "clients", "panier"]) bd.createObjectStore(m, { keyPath: "id" });
        bd.createObjectStore("file", { keyPath: "ordre", autoIncrement: true }).createIndex("cle", "cle", { unique: true });
      };
      demande.onsuccess = () => {
        // Une autre version de la page veut migrer la base : on lâche la connexion plutôt que de la bloquer.
        demande.result.onversionchange = () => { demande.result.close(); bases.delete(tenantId); };
        ok(demande.result);
      };
      demande.onerror = () => ko(demande.error);
      demande.onblocked = () => ko(new Error("Stockage local occupé par un autre onglet."));
    });
    base.catch(() => bases.delete(tenantId));
    bases.set(tenantId, base);
  }
  return base;
}

const attendre = <T>(r: IDBRequest<T>) => new Promise<T>((ok, ko) => { r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
const terminer = (tx: IDBTransaction) => new Promise<void>((ok, ko) => { tx.oncomplete = () => ok(); tx.onerror = () => ko(tx.error); tx.onabort = () => ko(tx.error ?? new Error("Écriture locale annulée.")); });

export async function tous<T>(bd: IDBDatabase, magasin: Magasin): Promise<T[]> {
  return attendre(bd.transaction(magasin).objectStore(magasin).getAll() as IDBRequest<T[]>);
}

export async function lire<T>(bd: IDBDatabase, magasin: Magasin, id: IDBValidKey): Promise<T | undefined> {
  return attendre(bd.transaction(magasin).objectStore(magasin).get(id) as IDBRequest<T | undefined>);
}

/** Écrit (ou remplace) des enregistrements, tout ou rien. */
export async function ecrire(bd: IDBDatabase, magasin: Magasin, valeurs: unknown[]): Promise<void> {
  const tx = bd.transaction(magasin, "readwrite");
  for (const v of valeurs) tx.objectStore(magasin).put(v);
  return terminer(tx);
}

export async function supprimer(bd: IDBDatabase, magasin: Magasin, ids: IDBValidKey[]): Promise<void> {
  const tx = bd.transaction(magasin, "readwrite");
  for (const id of ids) tx.objectStore(magasin).delete(id);
  return terminer(tx);
}

/** Remplace tout le contenu d'un magasin en une transaction : un téléchargement interrompu laisse l'ancien contenu intact. */
export async function remplacer(bd: IDBDatabase, magasin: Magasin, valeurs: unknown[]): Promise<void> {
  const tx = bd.transaction(magasin, "readwrite");
  tx.objectStore(magasin).clear();
  for (const v of valeurs) tx.objectStore(magasin).put(v);
  return terminer(tx);
}

/** Toute la file, dans l'ordre d'arrivée. */
export function lireFile(bd: IDBDatabase): Promise<Mutation[]> {
  return tous<Mutation>(bd, "file");
}

export async function mutationParCle(bd: IDBDatabase, cle: string): Promise<Mutation | undefined> {
  return attendre(bd.transaction("file").objectStore("file").index("cle").get(cle) as IDBRequest<Mutation | undefined>);
}

/**
 * Met une vente en file ET retire ses quantités du stock local, dans UNE
 * transaction : la vente est sur le disque avant que l'écran n'affiche le reçu.
 * Rend false si cette clé est déjà en file (rien n'est écrit) : pas de doublon.
 */
export async function enfiler(bd: IDBDatabase, m: Mutation, articlesModifies: unknown[]): Promise<boolean> {
  if (await mutationParCle(bd, m.cle)) return false;
  const tx = bd.transaction(["file", "catalogue"], "readwrite");
  // Deux onglets au même instant : l'index unique fait échouer le second, toute sa transaction est annulée.
  tx.objectStore("file").add(m);
  for (const a of articlesModifies) tx.objectStore("catalogue").put(a);
  try {
    await terminer(tx);
    return true;
  } catch (e) {
    if ((e as DOMException)?.name === "ConstraintError" || (await mutationParCle(bd, m.cle))) return false;
    throw e;
  }
}

/** Demande au navigateur de ne pas purger ce stockage. Rend true s'il l'accorde. */
export async function demanderPersistance(): Promise<boolean> {
  try { return (await navigator.storage?.persist?.()) ?? false; } catch { return false; }
}
