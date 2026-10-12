"use client";
// Import produit : le marchand choisit d'où vient le produit, puis saisit sa
// fiche (seule source réellement branchée aujourd'hui) ou charge un CSV.
// Les connecteurs « à connecter » n'offrent qu'un lien vers leur site : aucun
// bouton ne laisse croire à un import automatique.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { CONNECTEURS } from "@/lib/sourcing/connecteurs";
import { DEVISES_FOURNISSEUR } from "@/lib/sourcing/pays";
import { Page, Entete, Carte, PastilleIntegration, Bouton, Champ, CLASSE_CHAMP, Erreur, Onglets, envoyer } from "@/components/dashboard/sourcing/ui";

const estLien = (s: string) => { try { return /^https?:$/.test(new URL(s).protocol); } catch { return false; } };
const lignes = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

const FICHE_VIDE = {
  url: "", nom: "", prix: "", devise: "USD", moq: "", poids: "", stock: "", delai: "",
  fournisseur: "", sku: "", description: "", images: "", variantes: "",
};

function SaisieManuelle() {
  const t = useT();
  const router = useRouter();
  const [f, setF] = useState(FICHE_VIDE);
  const [envoi, setEnvoi] = useState<"manuel" | "sandbox" | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const champ = (cle: keyof typeof FICHE_VIDE) => ({
    value: f[cle], className: CLASSE_CHAMP,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((v) => ({ ...v, [cle]: e.target.value })),
  });
  const nombre = { type: "number", inputMode: "decimal", min: 0, step: "any" } as const;

  async function creer(corps: unknown, source: "manuel" | "sandbox") {
    setEnvoi(source); setErreur(null);
    try {
      const r = await envoyer<{ id: string }>("/api/sourcing/produits", "POST", corps);
      router.push("/dashboard/sourcing/produits/" + r.id);
    } catch (e) {
      setErreur((e as Error).message); setEnvoi(null);
    }
  }

  function importer(e: React.FormEvent) {
    e.preventDefault();
    const prix = Number(f.prix);
    if (f.nom.trim().length < 2) return setErreur(t("Donnez le nom du produit."));
    if (!(prix > 0)) return setErreur(t("Indiquez le prix du fournisseur."));
    const url = f.url.trim();
    if (url && !estLien(url)) return setErreur(t("Le lien du produit doit commencer par http:// ou https://"));
    const images = lignes(f.images);
    const mauvaise = images.find((i) => !estLien(i));
    if (mauvaise) return setErreur(t("Lien d'image invalide : {0}", mauvaise));
    // « Couleur : Rouge » → { nom: "Couleur", valeur: "Rouge" }
    const variantes = lignes(f.variantes).map((l) => {
      const i = l.indexOf(":");
      return { ligne: l, nom: i < 0 ? "" : l.slice(0, i).trim(), valeur: l.slice(i + 1).trim() };
    });
    const illisible = variantes.find((v) => !v.nom || !v.valeur);
    if (illisible) return setErreur(t("Variante illisible : « {0} ». Écrivez par exemple « Couleur : Rouge ».", illisible.ligne));

    // Le schéma refuse les valeurs vides : seuls les champs remplis sont envoyés.
    const entier = (s: string) => (s.trim() !== "" && Number(s) >= 0 ? Math.round(Number(s)) : undefined);
    const moq = entier(f.moq), stock = entier(f.stock), delai = entier(f.delai), poids = Number(f.poids);
    creer({
      connecteur: "manuel",
      ...(url && { url }),
      donnees: {
        nom: f.nom.trim(), prixFournisseur: prix, deviseFournisseur: f.devise,
        ...(moq && { moq }),
        ...(poids > 0 && { poidsKg: poids }),
        ...(stock !== undefined && { disponibilite: stock }),
        ...(delai && { logistique: { delaiJours: delai } }),
        ...(f.fournisseur.trim() && { fournisseurNom: f.fournisseur.trim() }),
        ...(f.sku.trim() && { sku: f.sku.trim() }),
        ...(f.description.trim() && { description: f.description.trim() }),
        ...(images.length > 0 && { images }),
        ...(variantes.length > 0 && { variantes: variantes.map(({ nom, valeur }) => ({ nom, valeur })) }),
      },
    }, "manuel");
  }

  return (
    <>
      <Carte titre="D'où vient le produit ?" aide="Actif = réellement branché. À connecter = prévu, pas encore disponible. Sandbox = données fictives pour essayer.">
        <ul className="divide-y divide-[#F0F0F0]">
          {CONNECTEURS.map((c) => (
            <li key={c.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[13px] font-bold text-[#111111]">{t(c.nom)}</p>
                <PastilleIntegration statut={c.statut} />
              </div>
              <p className="text-[12px] text-[#666666] mt-0.5 leading-relaxed">{t(c.description)}</p>
              {c.statut === "a_connecter" && (
                <>
                  <p className="text-[12px] text-[#666666] mt-1 leading-relaxed">{t("Cherchez votre produit sur le site, puis copiez ses informations ci-dessous. La connexion automatique n'est pas encore disponible.")}</p>
                  {c.urlSite && (
                    <a href={c.urlSite} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#B45309] mt-1.5 hover:underline">
                      {t("Ouvrir le site")}<ExternalLink size={11} />
                    </a>
                  )}
                </>
              )}
              {c.statut === "sandbox" && (
                <div className="mt-2">
                  <Bouton petit variante="secondaire" charge={envoi === "sandbox"} disabled={envoi !== null} onClick={() => creer({ connecteur: "sandbox" }, "sandbox")}>{t("Essayer avec un produit de démonstration")}</Bouton>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Carte>

      <Carte titre="Saisir la fiche du produit" aide="Seuls le nom et le prix sont obligatoires. Plus la fiche est complète, plus le calcul du coût est juste.">
        <form onSubmit={importer} className="space-y-4">
          <Champ label="Lien du produit (optionnel)" aide="L'adresse de la page du produit chez le fournisseur.">
            <input type="url" placeholder="https://" {...champ("url")} />
          </Champ>
          <Champ label="Nom du produit"><input required {...champ("nom")} /></Champ>
          <div className="grid grid-cols-2 gap-3">
            <Champ label="Prix fournisseur"><input required {...nombre} {...champ("prix")} /></Champ>
            <Champ label="Devise">
              <select {...champ("devise")}>{DEVISES_FOURNISSEUR.map((d) => <option key={d} value={d}>{d}</option>)}</select>
            </Champ>
            <Champ label="Quantité minimum (MOQ)" aide="Le plus petit nombre d'unités que le fournisseur accepte de vendre."><input {...nombre} step={1} {...champ("moq")} /></Champ>
            <Champ label="Poids (kg)" aide="Le transport se paie au poids."><input {...nombre} {...champ("poids")} /></Champ>
            <Champ label="Stock annoncé"><input {...nombre} step={1} {...champ("stock")} /></Champ>
            <Champ label="Délai d'expédition (jours)"><input {...nombre} step={1} {...champ("delai")} /></Champ>
            <Champ label="Nom du fournisseur"><input {...champ("fournisseur")} /></Champ>
            <Champ label="Référence (SKU)"><input {...champ("sku")} /></Champ>
          </div>
          <Champ label="Description"><textarea rows={3} {...champ("description")} /></Champ>
          <Champ label="Liens d'images" aide="Un lien par ligne."><textarea rows={3} placeholder="https://" {...champ("images")} /></Champ>
          <Champ label="Variantes" aide="Une par ligne, par exemple « Couleur : Rouge »."><textarea rows={3} {...champ("variantes")} /></Champ>
          {erreur && <Erreur message={erreur} />}
          <Bouton type="submit" charge={envoi === "manuel"} disabled={envoi !== null}>{t("Ajouter et analyser ce produit")}</Bouton>
        </form>
      </Carte>
    </>
  );
}

function ImportCsv() {
  const t = useT();
  const [fournisseurs, setFournisseurs] = useState<any[]>([]);
  const [fournisseurId, setFournisseurId] = useState("");
  const [csv, setCsv] = useState("");
  const [marge, setMarge] = useState("30");
  const [loading, setLoading] = useState(false);
  const [resultat, setResultat] = useState<any>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    fetch("/api/fournisseurs").then(r => r.json()).then(d => setFournisseurs(d.fournisseurs ?? [])).catch(() => {});
  }, []);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = e => setCsv(e.target?.result as string ?? "");
    reader.readAsText(file);
  }

  async function importer() {
    if (!csv) return;
    setLoading(true); setResultat(null);
    try {
      const res = await fetch("/api/fournisseurs/import-csv", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fournisseurId: fournisseurId || null, csv, marge: parseFloat(marge) }),
      });
      setResultat(await res.json());
    } catch {
      setResultat({ ok: false, message: "Erreur" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Carte titre="Importer un fichier CSV" aide="Crée directement les produits dans votre boutique, en masse, à partir du fichier de votre fournisseur.">
        <div className="space-y-4">
          <Champ label="Fournisseur (optionnel)">
            <select value={fournisseurId} onChange={e => setFournisseurId(e.target.value)} className={CLASSE_CHAMP}>
              <option value="">{t("Aucun fournisseur lié")}</option>
              {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
            </select>
          </Champ>

          <Champ label="Marge appliquée">
            <div className="flex items-center gap-2">
              <input type="number" min="0" max="500" value={marge} onChange={e => setMarge(e.target.value)} className={`${CLASSE_CHAMP} !w-24`} />
              <span className="text-[12px] text-[#666666]">{t("% au-dessus du prix fournisseur")}</span>
            </div>
          </Champ>

          <div>
            <span className="text-[11px] font-semibold text-[#666666] uppercase tracking-wide">{t("Fichier CSV")}</span>
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              className={`mt-1 border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${dragging ? "border-[#F5A623] bg-[#FFF8EC]" : "border-[#E8E8E8] hover:border-[#F5A623]/40"}`}
              onClick={() => document.getElementById("csvInput")?.click()}>
              <input id="csvInput" type="file" accept=".csv,.txt" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              {csv ? (
                <div>
                  <p className="text-[13px] font-semibold text-[#16A34A]">{t("✓ Fichier chargé")}</p>
                  <p className="text-[11px] text-[#AAAAAA]">{csv.split("\n").length - 1}{" "}{t("lignes détectées")}</p>
                </div>
              ) : (
                <div>
                  <p className="text-[13px] text-[#AAAAAA]">{t("Glissez votre CSV ici ou cliquez")}</p>
                  <p className="text-[10px] text-[#CCCCCC] mt-1">{t("Format: nom, description, prix, stock, sku, categorie, image")}</p>
                </div>
              )}
            </div>
          </div>

          {csv && (
            <div className="bg-[#F5F5F5] rounded-xl p-3">
              <p className="text-[10px] font-semibold text-[#AAAAAA] mb-1">{t("Aperçu (5 premières lignes)")}</p>
              <pre className="text-[10px] text-[#666666] whitespace-pre-wrap overflow-x-auto">
                {csv.split("\n").slice(0, 5).join("\n")}
              </pre>
            </div>
          )}

          <Bouton onClick={importer} disabled={!csv} charge={loading}>{loading ? t("Import en cours…") : t("Importer les produits")}</Bouton>
        </div>
      </Carte>

      {resultat && (
        <div className={`rounded-2xl p-5 border ${resultat.ok ? "bg-[#ECFDF5] border-[#BBF7D0]" : "bg-[#FEF2F2] border-[#FECACA]"}`}>
          {resultat.ok ? (
            <div>
              <p className="text-[14px] font-bold text-[#16A34A]">{resultat.importes}{" "}{t("produit(s) importé(s)")}</p>
              {resultat.erreurs > 0 && <p className="text-[12px] text-[#D97706] mt-1">{resultat.erreurs}{" "}{t("erreur(s) ignorée(s)")}</p>}
            </div>
          ) : (
            <p className="text-[13px] text-[#DC2626]">{t(resultat.message ?? resultat.error ?? "Erreur")}</p>
          )}
        </div>
      )}
    </>
  );
}

export default function ImportProduitPage() {
  const t = useT();
  const [onglet, setOnglet] = useState<"produit" | "csv">("produit");
  return (
    <Page etroite>
      <Entete titre="Import produit" sousTitre="Ajoutez un produit trouvé chez un fournisseur. Axso calcule ensuite son coût réel, un prix conseillé et un score." />
      <Onglets onglets={[{ cle: "produit", libelle: "Un produit" }, { cle: "csv", libelle: "Fichier CSV" }]} actif={onglet} onChange={setOnglet} />
      {onglet === "produit" ? <SaisieManuelle /> : <ImportCsv />}
      <p className="text-[11px] text-[#AAAAAA]">{t("Axso ne récupère aucune donnée automatiquement chez les fournisseurs pour l'instant : ce que vous saisissez est ce qui est analysé.")}</p>
    </Page>
  );
}
