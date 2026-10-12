"use client";
// Écran du téléphone-scanner. Le téléphone est un périphérique de CAPTURE :
// il lit des codes et les envoie à sa caisse (POST /api/pos/scanner/scans) ;
// le panier et le paiement restent sur le poste. Aucun bouton « envoyer » :
// chaque lecture part seule et apparaît sur la caisse par le flux temps réel.
//
// Coupure réseau : les scans attendent dans une courte file locale
// (localStorage, 50 au plus) et repartent DANS L'ORDRE au retour du réseau,
// avec le même scanId — le serveur ne crée donc jamais de doublon.
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, PackageSearch, ScanLine, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/components/I18nProvider";
import { DeviseProvider, useDevise } from "@/components/dashboard/DeviseProvider";
import { Badge, BadgeConnexion, Bouton, EtatChargement, EtatHorsLigne, EtatNonAutorise, FOCUS, POLICE, Saisie, TONS, type Ton } from "@/components/pos/ui";
import { LecteurCamera, retourScan } from "@/components/pos/scanner/LecteurCamera";
import { nouveauScanId } from "@/lib/pos/client/bus";
import { libelleQuantite } from "@/lib/pos/tarification";
import type { ArticleResolu, ContexteScan, DroitsPos } from "@/lib/pos/types";
import { CONTEXTES_SCAN, INTERVALLE_SIGNAL_MS, ajouterALaFile, contexteAutorise, type EtatScan, type ScanEnAttente } from "@/lib/pos/scanner/regles";

type Infos = {
  appareil: { id: string; nom: string } | null;
  caisse: { id: string; nom: string } | null;
  magasin: { id: string; nom: string } | null;
  boutique: { nom: string; devise: string };
  session: { ouverte: boolean; obligatoire: boolean };
  droits: DroitsPos;
};
type Dernier = { code: string; etat: EtatScan | "envoi" | "attente" | "refuse"; message: string | null; article: ArticleResolu | null };

const CLE_FILE = "axso_scanner_file";
const CLE_INFOS = "axso_scanner_infos";
const CLE_CONTEXTE = "axso_scanner_contexte";
const API = (chemin: string) => `/api/pos/scanner/${chemin}?appareil=1`;

const lire = <T,>(cle: string, defaut: T): T => {
  try { return JSON.parse(localStorage.getItem(cle) ?? "") as T; } catch { return defaut; }
};
const ecrire = (cle: string, valeur: unknown) => {
  try { localStorage.setItem(cle, JSON.stringify(valeur)); } catch { /* stockage plein ou interdit : la file vit en mémoire */ }
};

export default function EcranScanner() {
  const t = useT();
  const [phase, setPhase] = useState<"demarrage" | "injoignable" | "non_appaire" | "pret">("demarrage");
  const [refus, setRefus] = useState<string | null>(null);
  const [infos, setInfos] = useState<Infos | null>(null);
  const [reseau, setReseau] = useState(true);
  const [contexte, setContexte] = useState<ContexteScan>("vente");
  const [camera, setCamera] = useState(false);
  const [dernier, setDernier] = useState<Dernier | null>(null);
  const [enAttente, setEnAttente] = useState(0);
  const [saisie, setSaisie] = useState("");
  const file = useRef<ScanEnAttente[]>([]);
  const envoi = useRef(false);
  const demarre = useRef(false);

  const garderFile = (suite: ScanEnAttente[]) => { file.current = suite; ecrire(CLE_FILE, suite); setEnAttente(suite.length); };

  const desappairer = useCallback((message: string) => {
    setRefus(message);
    setCamera(false);
    setPhase("non_appaire");
  }, []);

  /** Signe de vie : dit à la caisse que le téléphone est là, et rafraîchit ce qu'il affiche. */
  const signaler = useCallback(async () => {
    try {
      const r = await fetch(API("signal"), { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const corps = await r.json().catch(() => ({}));
      if (r.status === 401) { desappairer(corps.error ?? "Ce téléphone n'est pas relié à une caisse."); return; }
      if (!r.ok) throw new Error(String(r.status));
      setInfos(corps);
      ecrire(CLE_INFOS, corps);
      setReseau(true);
      setPhase("pret");
    } catch {
      setReseau(false);
      // Déjà appairé auparavant : on garde l'écran de scan, les lectures iront en file.
      setPhase((p) => (p === "pret" || p === "non_appaire" ? p : lire<Infos | null>(CLE_INFOS, null) ? "pret" : "injoignable"));
    }
  }, [desappairer]);

  /** Envoie la file, un scan à la fois, dans l'ordre de lecture. S'arrête à la première coupure. */
  const vider = useCallback(async () => {
    if (envoi.current) return;
    envoi.current = true;
    try {
      while (file.current.length) {
        const scan = file.current[0];
        let r: Response;
        try {
          r = await fetch(API("scans"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...scan, source: "mobile" }) });
        } catch {
          setReseau(false);
          r = new Response(null, { status: 503 });
        }
        // Coupure ou serveur indisponible : le scan reste en tête de file et repartira.
        if (r.status >= 500 || r.status === 429) {
          setDernier((d) => (d?.etat === "envoi" ? { ...d, etat: "attente", message: "Ce scan partira vers la caisse dès le retour du réseau." } : d));
          return;
        }
        const corps = await r.json().catch(() => ({}));
        setReseau(true);
        if (r.status === 401) { desappairer(corps.error ?? "Cet appareil n'est plus autorisé."); return; }
        garderFile(file.current.slice(1));
        if (r.ok) {
          setDernier({ code: scan.code, etat: corps.etat, message: corps.message ?? null, article: corps.article ?? null });
          if (corps.etat === "inconnu" || corps.etat === "ambigu" || corps.etat === "inactif") retourScan(true);
        } else {
          // Refus définitif (droit manquant, caisse fermée…) : le scan n'est pas gardé, la raison est affichée.
          setDernier({ code: scan.code, etat: "refuse", message: corps.error ?? "Ce scan a été refusé par la caisse.", article: null });
          retourScan(true);
        }
      }
    } finally {
      envoi.current = false;
    }
  }, [desappairer]);

  const scanner = useCallback((code: string) => {
    const scan: ScanEnAttente = { scanId: nouveauScanId(), code: code.trim(), contexte, scanneAt: new Date().toISOString() };
    if (!scan.code) return;
    const suite = ajouterALaFile(file.current, scan);
    if (!suite) {
      retourScan(true);
      setDernier({ code: scan.code, etat: "refuse", message: "Trop de scans en attente. Retrouvez du réseau avant de continuer : rien n'a été perdu.", article: null });
      return;
    }
    garderFile(suite);
    setDernier({ code: scan.code, etat: "envoi", message: null, article: null });
    void vider();
  }, [contexte, vider]);

  // Démarrage : échange du code du QR s'il y en a un, puis premier signal.
  useEffect(() => {
    if (demarre.current) return;
    demarre.current = true;
    garderFile(lire<ScanEnAttente[]>(CLE_FILE, []));
    setInfos(lire<Infos | null>(CLE_INFOS, null));
    const memorise = lire<ContexteScan>(CLE_CONTEXTE, "vente");
    if (CONTEXTES_SCAN.some((c) => c.id === memorise)) setContexte(memorise);
    (async () => {
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        // Le code ne sert qu'une fois : il ne reste ni dans la barre d'adresse ni dans l'historique.
        window.history.replaceState(null, "", "/scanner");
        try {
          const r = await fetch("/api/pos/scanner/appairage/echange", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
          if (!r.ok) { desappairer((await r.json().catch(() => ({}))).error ?? "L'appairage a échoué. Affichez un nouveau QR code sur la caisse."); return; }
          // Nouvelle caisse : les scans en attente appartenaient à l'ancienne.
          garderFile([]);
        } catch {
          desappairer("Connexion interrompue pendant l'appairage. Retrouvez du réseau, puis scannez de nouveau le QR code de la caisse.");
          return;
        }
      }
      await signaler();
      void vider();
    })();
  }, [desappairer, signaler, vider]);

  // Vie de l'écran : signal régulier, reprise de la file, retour du réseau, fermeture.
  useEffect(() => {
    if (phase !== "pret") return;
    const battement = setInterval(() => void signaler(), INTERVALLE_SIGNAL_MS);
    const reprise = setInterval(() => { if (file.current.length) void vider(); }, 5000);
    const auRetour = () => { void signaler().then(() => vider()); };
    const aLaCoupure = () => setReseau(false);
    const auReveil = () => { if (document.visibilityState === "visible") auRetour(); };
    const aLaFermeture = () => { navigator.sendBeacon?.(API("signal"), new Blob([JSON.stringify({ etat: "hors_ligne" })], { type: "application/json" })); };
    window.addEventListener("online", auRetour);
    window.addEventListener("offline", aLaCoupure);
    document.addEventListener("visibilitychange", auReveil);
    window.addEventListener("pagehide", aLaFermeture);
    return () => {
      clearInterval(battement);
      clearInterval(reprise);
      window.removeEventListener("online", auRetour);
      window.removeEventListener("offline", aLaCoupure);
      document.removeEventListener("visibilitychange", auReveil);
      window.removeEventListener("pagehide", aLaFermeture);
    };
  }, [phase, signaler, vider]);

  // Caisse injoignable au démarrage (et rien en mémoire) : on réessaie seul.
  useEffect(() => {
    if (phase !== "injoignable") return;
    const i = setInterval(() => void signaler(), 5000);
    return () => clearInterval(i);
  }, [phase, signaler]);

  // L'écran reste allumé pendant qu'on scanne (quand le téléphone le permet).
  useEffect(() => {
    if (!camera) return;
    let verrou: { release: () => Promise<void> } | null = null;
    (navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock
      ?.request("screen").then((v) => { verrou = v; }).catch(() => {});
    return () => { void verrou?.release().catch(() => {}); };
  }, [camera]);

  const choisir = (id: ContexteScan) => { setContexte(id); ecrire(CLE_CONTEXTE, id); };

  if (phase === "demarrage") {
    return <main className="flex min-h-dvh items-center justify-center bg-[#F5F5F5] p-4" style={POLICE}><EtatChargement texte="Connexion à la caisse…" /></main>;
  }

  if (phase === "injoignable") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#F5F5F5] p-4" style={POLICE}>
        <EtatHorsLigne titre="Caisse injoignable" texte="Ce téléphone n'arrive pas à joindre la caisse. Vérifiez la connexion : une nouvelle tentative est faite toutes les 5 secondes." onReessayer={() => void signaler()} className="w-full max-w-md" />
      </main>
    );
  }

  if (phase === "non_appaire") {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#F5F5F5] p-4" style={POLICE}>
        <EtatNonAutorise titre="Téléphone non relié à une caisse" texte={refus ?? undefined} className="w-full max-w-md">
          <ol className="list-decimal space-y-1 pl-5 text-left text-[12.5px] leading-relaxed text-[#666666]">
            <li>{t("Sur l'ordinateur, ouvrez la caisse.")}</li>
            <li>{t("Choisissez « Connecter un scanner ».")}</li>
            <li>{t("Scannez le QR code affiché avec l'appareil photo de ce téléphone.")}</li>
          </ol>
        </EtatNonAutorise>
      </main>
    );
  }

  const actuel = CONTEXTES_SCAN.find((c) => c.id === contexte) ?? CONTEXTES_SCAN[0];
  const autorise = !infos || contexteAutorise(infos.droits, contexte);
  const caisseFermee = contexte === "vente" && !!infos?.session.obligatoire && !infos.session.ouverte;

  return (
    <DeviseProvider devise={infos?.boutique.devise ?? "XAF"}>
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-[#F5F5F5] text-[#111111]" style={POLICE}>
        <header className="bg-[#111111] px-4 pb-4 pt-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#F5A623]">{t("AXSO Scanner")}</p>
              <h1 className="mt-1 truncate text-[20px] font-bold leading-tight">{infos?.caisse?.nom ?? t("Caisse")}</h1>
              <p className="truncate text-[13px] text-white/70">{infos?.magasin?.nom ?? infos?.boutique.nom ?? ""}</p>
            </div>
            <BadgeConnexion etat={!reseau ? "hors_ligne" : enAttente ? "synchronisation" : "en_ligne"} enAttente={enAttente || undefined} />
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 px-4 py-4">
          <div>
            <div role="radiogroup" aria-label={t("À quoi sert le scan")} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {CONTEXTES_SCAN.map((c) => {
                const choisi = c.id === contexte;
                const permis = !infos || contexteAutorise(infos.droits, c.id);
                return (
                  <button
                    key={c.id} type="button" role="radio" aria-checked={choisi} disabled={!permis} onClick={() => choisir(c.id)}
                    className={cn("min-h-11 shrink-0 rounded-full border px-4 text-[13px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40", FOCUS,
                      choisi ? "border-[#111111] bg-[#111111] text-white" : "border-[#E8E8E8] bg-white text-[#111111]")}
                  >
                    {t(c.libelle)}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-[#666666]">{t(actuel.aide)}</p>
          </div>

          {!autorise && <Avis ton="danger">{t("Ce téléphone n'a pas le droit de scanner dans ce mode. Demandez à un responsable.")}</Avis>}
          {caisseFermee && <Avis ton="attention">{t("La caisse est fermée. Ouvrez-la sur l'ordinateur avant de scanner des articles à vendre.")}</Avis>}
          {!reseau && <Avis ton="attention">{t("Mode hors ligne. Vous pouvez continuer à scanner : les codes partiront vers la caisse, dans l'ordre, dès le retour du réseau.")}</Avis>}

          <LecteurCamera actif={camera} onCode={scanner} className="aspect-[4/3] w-full" />

          <button
            type="button" disabled={!autorise} onClick={() => setCamera((c) => !c)} aria-pressed={camera}
            className={cn("flex min-h-20 w-full items-center justify-center gap-3 rounded-2xl text-[20px] font-extrabold tracking-wide shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50", FOCUS,
              camera ? "bg-[#111111] text-white" : "bg-[#F5A623] text-[#111111] active:bg-[#D4911A]")}
          >
            {camera ? <Square size={22} aria-hidden /> : <ScanLine size={26} aria-hidden />}
            {t(camera ? "ARRÊTER" : "SCANNER")}
          </button>

          <section aria-live="polite" aria-label={t("Dernier produit scanné")}>
            {dernier ? <CarteDernier dernier={dernier} /> : (
              <div className="rounded-2xl border border-dashed border-[#E8E8E8] bg-white px-4 py-6 text-center text-[12.5px] text-[#666666]">
                <PackageSearch size={22} className="mx-auto mb-2 text-[#AAAAAA]" aria-hidden />
                {t("Le dernier produit scanné s'affichera ici.")}
              </div>
            )}
          </section>

          <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (saisie.trim()) { scanner(saisie); setSaisie(""); } }}>
            <Saisie label="Code illisible ? Saisissez-le" inputMode="text" autoComplete="off" autoCapitalize="off" maxLength={128} value={saisie} onChange={(e) => setSaisie(e.target.value)} disabled={!autorise} className="min-w-0 flex-1" />
            <Bouton type="submit" variante="secondaire" disabled={!autorise || !saisie.trim()}>{t("Envoyer")}</Bouton>
          </form>

          <p className="mt-auto pt-2 text-center text-[11.5px] leading-relaxed text-[#AAAAAA]">
            {infos?.appareil ? `${infos.appareil.nom} · ` : ""}{t("Ce téléphone sert à scanner. Le panier et le paiement se font sur la caisse.")}
          </p>
        </div>
      </main>
    </DeviseProvider>
  );
}

function Avis({ ton, children }: { ton: Ton; children: React.ReactNode }) {
  return (
    <p role="status" className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-[12.5px] leading-relaxed" style={TONS[ton]}>
      <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/** Dernier scan : nom, prix, stock — ou ce qui n'a pas marché, en clair. */
function CarteDernier({ dernier }: { dernier: Dernier }) {
  const t = useT();
  const { fmt } = useDevise();
  const a = dernier.article;
  const ton: Ton = dernier.etat === "ok" ? "positif" : dernier.etat === "envoi" ? "info" : dernier.etat === "attente" || dernier.etat === "epuise" ? "attention" : "danger";
  const libelle = { ok: "Envoyé à la caisse", envoi: "Envoi…", attente: "En attente d'envoi", epuise: "Stock épuisé", inconnu: "Produit non reconnu", ambigu: "Code ambigu", inactif: "Article retiré", refuse: "Refusé" }[dernier.etat];
  const stock = a ? a.stockMagasin ?? a.stock : 0;
  return (
    <div className="rounded-2xl border border-[#E8E8E8] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#AAAAAA]">{t("Dernier produit")}</p>
          <p className="mt-1 break-words text-[16px] font-bold leading-snug">{a ? a.nom : dernier.code}</p>
          {a?.variante && <p className="text-[12.5px] text-[#666666]">{a.variante}</p>}
        </div>
        <Badge ton={ton}>{t(libelle)}</Badge>
      </div>
      {a && (
        <dl className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <dt className="text-[11px] text-[#666666]">{t(a.uniteVente === "kg" ? "Prix au kilo" : "Prix")}</dt>
            <dd className="text-[18px] font-extrabold">{fmt(a.prix)}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-[#666666]">{t(a.stockMagasin === null ? "Stock" : "Stock du magasin")}</dt>
            <dd className={cn("text-[18px] font-extrabold", stock <= 0 && "text-[#B91C1C]")}>{libelleQuantite(stock, a.uniteVente)}</dd>
          </div>
        </dl>
      )}
      {a && <p className="mt-2 font-mono text-[11.5px] text-[#AAAAAA]">{dernier.code}</p>}
      {dernier.message && <p className="mt-2 text-[12.5px] leading-relaxed text-[#666666]">{t(dernier.message)}</p>}
    </div>
  );
}
