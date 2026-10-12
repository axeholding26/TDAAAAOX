"use client";
// Catalogue Sourcing : les produits repérés par le marchand, avec leur coût réel,
// leur prix conseillé et leur score. Aucun produit n'est proposé par Axso :
// tant qu'aucun catalogue fournisseur n'est branché, la liste ne contient que
// ce que le marchand a importé lui-même.
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Star, Search, Package, Check } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { CONFIG_PAYS, type CodePays } from "@/lib/sourcing/pays";
import { ETAPES_PRODUIT } from "@/lib/sourcing/produit-source";
import { Page, Entete, Carte, Pastille, Estimation, Bouton, CLASSE_CHAMP, EtatVide, Chargement, Erreur, Onglets, pourcent, useApi, envoyer, type Ton } from "@/components/dashboard/sourcing/ui";

interface ProduitCatalogue {
  id: string; nom: string; image: string | null; connecteur: string; fournisseurNom: string | null;
  favori: boolean; etape: string; produitId: string | null;
  coutTotal: number; prixVente: number | null; prixConseille: number; margeNette: number | null; tauxMargeNette: number | null;
  score: number; confianceScore: number; niveau: "excellent" | "bon" | "moyen" | "risque"; verdict: string;
  concurrence: number | null; logistique: number | null;
}
interface Catalogue {
  produits: ProduitCatalogue[];
  aAnalyser: { id: string; nom: string; image: string | null; prix: number; prixFournisseur: number | null }[];
  pays: CodePays;
}

const VUES = [
  { cle: "tous", libelle: "Tous" },
  { cle: "favoris", libelle: "Favoris" },
  { cle: "test", libelle: "En test" },
  { cle: "gagnants", libelle: "Gagnants" },
] as const;
type Vue = (typeof VUES)[number]["cle"];

const TON_NIVEAU: Record<ProduitCatalogue["niveau"], Ton> = { excellent: "positif", bon: "positif", moyen: "accent", risque: "attention" };

/** Note du marchand (1 à 5, 5 = favorable) traduite en niveau de risque. */
function risque(note: number | null): { libelle: string; ton: Ton } {
  if (note === null) return { libelle: "non estimé", ton: "neutre" };
  return note >= 4 ? { libelle: "Faible", ton: "positif" } : note === 3 ? { libelle: "Moyen", ton: "accent" } : { libelle: "Élevé", ton: "attention" };
}

function Vignette({ image }: { image: string | null }) {
  return image
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={image} alt="" className="w-16 h-16 rounded-xl object-cover border border-[#E8E8E8] flex-shrink-0" />
    : <div className="w-16 h-16 rounded-xl bg-[#F5F5F5] border border-[#E8E8E8] flex items-center justify-center flex-shrink-0"><Package size={20} className="text-[#CCCCCC]" /></div>;
}

function Ligne({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <dt className="text-[12px] text-[#666666]">{libelle}</dt>
      <dd className="text-[12px] font-semibold text-[#111111] text-right flex items-center gap-1.5 flex-wrap justify-end">{children}</dd>
    </div>
  );
}

function ContenuCatalogue() {
  const t = useT();
  const { fmt } = useDevise();
  const router = useRouter();
  const params = useSearchParams();
  const vue: Vue = VUES.find((v) => v.cle === params.get("vue"))?.cle ?? "tous";
  const [saisie, setSaisie] = useState("");
  const [q, setQ] = useState("");
  const { data, setData, erreur, chargement } = useApi<Catalogue>(`/api/sourcing/produits?vue=${vue}${q ? `&q=${encodeURIComponent(q)}` : ""}`);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreurAction, setErreurAction] = useState<string | null>(null);
  const [publie, setPublie] = useState<{ produitId: string; cree: boolean } | null>(null);

  const maj = (id: string, champs: Partial<ProduitCatalogue>) =>
    setData((d) => d && { ...d, produits: d.produits.map((p) => (p.id === id ? { ...p, ...champs } : p)) });

  async function action(cle: string, faire: () => Promise<void>) {
    setEnCours(cle); setErreurAction(null); setPublie(null);
    try { await faire(); } catch (e) { setErreurAction((e as Error).message); } finally { setEnCours(null); }
  }
  const basculerFavori = (p: ProduitCatalogue) => action(`favori:${p.id}`, async () => {
    await envoyer(`/api/sourcing/produits/${p.id}`, "PATCH", { favori: !p.favori });
    maj(p.id, { favori: !p.favori });
  });
  const publier = (p: ProduitCatalogue) => action(`publier:${p.id}`, async () => {
    const r = await envoyer<{ produitId: string; cree: boolean }>(`/api/sourcing/produits/${p.id}/publier`, "POST");
    maj(p.id, { produitId: r.produitId });
    setPublie(r);
  });
  const analyserProduitBoutique = (produitId: string) => action(`analyser:${produitId}`, async () => {
    const r = await envoyer<{ id: string }>("/api/sourcing/produits", "POST", { produitId });
    router.push(`/dashboard/sourcing/produits/${r.id}`);
  });

  const gagnants = vue === "gagnants";
  const pays = data ? CONFIG_PAYS[data.pays]?.nom : undefined;

  return (
    <Page>
      <Entete titre="Catalogue sourcing" sousTitre="Les produits que vous avez repérés, avec leur coût réel et leur score."
        actions={<Bouton href="/dashboard/sourcing/import">{t("Ajouter un produit")}</Bouton>} />

      <Onglets onglets={[...VUES]} actif={vue} onChange={(v) => router.replace(v === "tous" ? "/dashboard/sourcing/catalogue" : `/dashboard/sourcing/catalogue?vue=${v}`)} />

      <form onSubmit={(e) => { e.preventDefault(); setQ(saisie.trim()); }} className="flex gap-2">
        <input value={saisie} onChange={(e) => setSaisie(e.target.value)} placeholder={t("Rechercher un produit par son nom")} className={CLASSE_CHAMP} />
        <Bouton type="submit" variante="secondaire"><Search size={14} />{t("Rechercher")}</Bouton>
      </form>

      {erreurAction && <Erreur message={erreurAction} />}
      {publie && (
        <div className="rounded-2xl p-4 border bg-[#ECFDF5] border-[#BBF7D0] flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[13px] font-semibold text-[#15803D] flex items-center gap-1.5">
            <Check size={15} />{publie.cree ? t("Le produit est maintenant dans votre boutique.") : t("Le prix et le coût du produit ont été mis à jour dans votre boutique.")}
          </p>
          <Bouton petit variante="secondaire" href={`/dashboard/produits/${publie.produitId}`}>{t("Voir le produit")}</Bouton>
        </div>
      )}

      {chargement && !data ? <Chargement /> : erreur ? <Erreur message={erreur} /> : data && (
        <>
          {gagnants && data.produits.length > 0 && (
            <div>
              <h2 className="text-[14px] font-bold text-[#111111]">{t("Produits à fort potentiel")}</h2>
              <p className="text-[12px] text-[#666666] mt-0.5">{t("Ce sont vos produits passés à l'étape Validation ou au-delà. Axso n'y ajoute aucun produit.")}</p>
            </div>
          )}

          {data.produits.length === 0 ? (
            gagnants ? (
              <EtatVide titre="Aucun produit gagnant pour l'instant."
                texte="Un produit devient gagnant quand vous le passez à l'étape Validation après un test rentable. Aucun catalogue fournisseur n'est encore connecté : Axso ne vous montre pas de produits inventés.">
                <Bouton href="/dashboard/sourcing/catalogue?vue=test" variante="secondaire">{t("Voir mes produits en test")}</Bouton>
              </EtatVide>
            ) : q ? (
              <EtatVide titre="Aucun produit ne correspond à votre recherche." />
            ) : (
              <EtatVide titre={vue === "favoris" ? "Aucun produit favori." : vue === "test" ? "Aucun produit en test." : "Votre catalogue est vide."}
                texte={vue === "favoris" ? "Touchez l'étoile d'un produit pour le retrouver ici." : vue === "test" ? "Un produit passe en test quand vous l'importez dans votre boutique." : "Ajoutez un premier produit trouvé chez un fournisseur : Axso calcule son coût réel et son score."}>
                <Bouton href="/dashboard/sourcing/import">{t("Importer un produit")}</Bouton>
                {vue !== "tous" && <Bouton href="/dashboard/sourcing/catalogue" variante="secondaire">{t("Voir tout le catalogue")}</Bouton>}
              </EtatVide>
            )
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {data.produits.map((p) => {
                const concurrence = risque(p.concurrence);
                const logistique = risque(p.logistique);
                return (
                  <Carte key={p.id} className="flex flex-col">
                    <div className="flex gap-3">
                      <Vignette image={p.image} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold text-[#111111] leading-snug line-clamp-2">{p.nom}</p>
                        <p className="text-[11px] text-[#AAAAAA] mt-0.5 truncate">{p.fournisseurNom ?? t("Fournisseur non renseigné")}</p>
                        <div className="flex gap-1.5 flex-wrap mt-1.5">
                          <Pastille>{t(ETAPES_PRODUIT.find((e) => e.cle === p.etape)?.libelle ?? p.etape)}</Pastille>
                          {p.connecteur === "sandbox" && <Pastille ton="info">{t("Sandbox — données fictives")}</Pastille>}
                          {p.produitId && <Pastille ton="positif">{t("En boutique")}</Pastille>}
                        </div>
                      </div>
                      <button onClick={() => basculerFavori(p)} disabled={enCours === `favori:${p.id}`} className="self-start p-1 -m-1"
                        aria-label={p.favori ? t("Retirer des favoris") : t("Ajouter aux favoris")} aria-pressed={p.favori}>
                        <Star size={18} fill={p.favori ? "#F5A623" : "none"} className={p.favori ? "text-[#F5A623]" : "text-[#CCCCCC]"} />
                      </button>
                    </div>

                    <dl className="mt-3 divide-y divide-[#F0F0F0] flex-1">
                      <Ligne libelle={gagnants ? t("Coût") : t("Coût réel par commande")}>{fmt(p.coutTotal)}</Ligne>
                      <Ligne libelle={gagnants ? t("Prix recommandé") : t("Prix conseillé")}>{fmt(p.prixConseille)}</Ligne>
                      <Ligne libelle={gagnants ? t("Marge") : t("Bénéfice par commande")}>
                        {p.margeNette === null ? "—" : (
                          <span style={{ color: p.margeNette >= 0 ? "#15803D" : "#B91C1C" }}>{fmt(p.margeNette)} ({pourcent(p.tauxMargeNette)})</span>
                        )}
                      </Ligne>
                      <Ligne libelle={t("Score")}>
                        <span>{p.score}/100</span>
                        <Pastille ton={TON_NIVEAU[p.niveau]}>{t(p.verdict)}</Pastille>
                        {p.confianceScore < 1 && <Estimation>{t("score partiel")}</Estimation>}
                      </Ligne>
                      {gagnants && (
                        <>
                          <Ligne libelle={t("Niveau de concurrence")}><Pastille ton={concurrence.ton}>{t(concurrence.libelle)}</Pastille><Estimation /></Ligne>
                          <Ligne libelle={t("Risque logistique")}><Pastille ton={logistique.ton}>{t(logistique.libelle)}</Pastille><Estimation /></Ligne>
                          <Ligne libelle={t("Pays")}>{pays ? t(pays) : "—"}</Ligne>
                        </>
                      )}
                    </dl>

                    <div className="flex gap-2 flex-wrap mt-3">
                      {/* Un seul bouton principal : importer tant que le produit n'est pas en boutique, sinon analyser. */}
                      {!p.produitId && p.connecteur !== "sandbox" && (
                        <Bouton petit onClick={() => publier(p)} charge={enCours === `publier:${p.id}`}>{t("Importer dans ma boutique")}</Bouton>
                      )}
                      <Bouton petit variante={p.produitId || p.connecteur === "sandbox" ? "primaire" : "secondaire"} href={`/dashboard/sourcing/produits/${p.id}`}>{t("Analyser")}</Bouton>
                      {p.produitId && <Bouton petit variante="secondaire" href={`/dashboard/produits/${p.produitId}`}>{t("Voir en boutique")}</Bouton>}
                    </div>
                  </Carte>
                );
              })}
            </div>
          )}

          {vue === "tous" && !q && data.aAnalyser.length > 0 && (
            <Carte titre="Produits de votre boutique à analyser" aide="Ces produits ont un prix fournisseur mais n'ont jamais été analysés. Vérifiez qu'ils sont vraiment rentables.">
              <ul className="divide-y divide-[#F0F0F0]">
                {data.aAnalyser.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-[#111111] truncate">{p.nom}</p>
                      <p className="text-[11px] text-[#666666]">
                        {t("Vendu {0}", fmt(p.prix))}{p.prixFournisseur !== null && ` · ${t("acheté {0}", fmt(p.prixFournisseur))}`}
                      </p>
                    </div>
                    <Bouton petit variante="discret" onClick={() => analyserProduitBoutique(p.id)} charge={enCours === `analyser:${p.id}`}>{t("Analyser")}</Bouton>
                  </li>
                ))}
              </ul>
            </Carte>
          )}
        </>
      )}
    </Page>
  );
}

// useSearchParams impose une frontière Suspense pour que le reste de la page puisse être prérendu.
export default function CataloguePage() {
  return <Suspense fallback={<Chargement />}><ContenuCatalogue /></Suspense>;
}
