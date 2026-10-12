"use client";
// Mise en route de la caisse en 8 étapes (§75). Chaque étape est cochée par le
// serveur d'après les données réelles (GET /api/pos/demarrage) et mène à
// l'écran où la faire. La dernière active la caisse : elle allume les drapeaux
// utiles au type de commerce. La visite de démonstration (§76) est proposée ici.
import { useState } from "react";
import { Check, Circle } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { Badge, Bouton, EtatChargement, EtatPos } from "@/components/pos/ui";
import { Carte, EnTete, Page, appelPos, useLecture, type ErreurAppel } from "@/components/pos/finance/commun";
import { EXPLICATION_FLAGS, MODELES_COMMERCE } from "@/lib/pos/types-commerce";
import type { FlagPos, TypeCommerce } from "@/lib/pos/types";
import VisiteDemo from "./VisiteDemo";

type IdEtape = "magasin" | "caisse" | "utilisateur" | "produits" | "scanner" | "paiements" | "vente_test" | "activation";
type Reponse = {
  etapes: { id: IdEtape; fait: boolean; passee: boolean; facultative: boolean; detail: string }[];
  faites: number; total: number; active: boolean; typeCommerce: TypeCommerce; flags: Record<FlagPos, boolean>; flagsActivation: FlagPos[];
};

const ETAPES: Record<IdEtape, { titre: string; texte: string; href?: string; action?: string; passer?: string }> = {
  magasin: { titre: "Créer le magasin", texte: "Un magasin principal est créé pour vous. Vérifiez son nom et son adresse : ils figurent sur les reçus.", href: "/dashboard/pos/reglages#magasins", action: "Voir les magasins" },
  caisse: { titre: "Créer la caisse", texte: "Une caisse par poste d'encaissement. Chaque caisse a sa session et son tiroir.", href: "/dashboard/pos/reglages#magasins", action: "Voir les caisses" },
  utilisateur: { titre: "Ajouter un utilisateur", texte: "Invitez vos caissiers : chacun a son compte et ses droits, et chaque vente porte son nom.", href: "/dashboard/parametres/equipe", action: "Inviter un membre", passer: "Je travaille seul" },
  produits: { titre: "Importer les produits", texte: "Importez votre catalogue depuis un fichier, ou créez vos produits un par un.", href: "/dashboard/pos/import", action: "Importer des produits" },
  scanner: { titre: "Associer un scanner", texte: "Un téléphone devient scanner en scannant un QR code. Une douchette USB fonctionne sans réglage.", href: "/dashboard/pos/reglages#appareils", action: "Connecter un scanner", passer: "Pas de scanner pour l'instant" },
  paiements: { titre: "Configurer les paiements", texte: "Choisissez les moyens de paiement proposés à la caisse.", href: "/dashboard/pos/reglages#paiements", action: "Régler les paiements", passer: "Mes moyens de paiement sont bons" },
  vente_test: { titre: "Faire une vente test", texte: "Encaissez un article pour voir le parcours complet. Une vente test est une vraie vente : annulez-la ensuite depuis son reçu.", href: "/dashboard/pos/caisse", action: "Ouvrir la caisse" },
  activation: { titre: "Activer la caisse", texte: "Allume les fonctions utiles à votre type de commerce. Vous pourrez les modifier dans les réglages." },
};

export function Demarrage() {
  const t = useT();
  const { donnees, erreur, recharger } = useLecture<Reponse>("/api/pos/demarrage");
  const [envoi, setEnvoi] = useState<string | null>(null);
  const [refus, setRefus] = useState<ErreurAppel | null>(null);
  const [demo, setDemo] = useState(false);

  const envoyer = async (corps: { action: "passer"; etape: IdEtape } | { action: "activer" }) => {
    setEnvoi(corps.action === "activer" ? "activation" : corps.etape);
    const r = await appelPos("/api/pos/demarrage", { method: "POST", corps });
    setEnvoi(null);
    if (!r.ok) { setRefus({ code: r.code, message: r.message }); return; }
    setRefus(null);
    await recharger();
  };

  if (erreur && !donnees) return <Page><EnTete titre="Mise en route" /><EtatPos code={erreur.code} message={erreur.message} onReessayer={recharger} /></Page>;
  if (!donnees) return <Page><EnTete titre="Mise en route" /><EtatChargement /></Page>;
  const modele = MODELES_COMMERCE[donnees.typeCommerce];
  const prochaine = donnees.etapes.find((e) => !e.fait)?.id;

  return (
    <Page>
      <EnTete titre="Mise en route" sousTitre="Huit étapes pour encaisser votre première vente. Les étapes se cochent d'elles-mêmes quand elles sont faites.">
        <Bouton variante="secondaire" onClick={() => setDemo(true)}>{t("Essayer la caisse en démonstration")}</Bouton>
      </EnTete>

      <div className="rounded-2xl border border-[#E8E8E8] bg-white p-4">
        <div className="flex items-center justify-between gap-3 text-[13px]">
          <p className="font-bold text-[#111111]">{t("{0} étape(s) sur {1}", donnees.faites, donnees.total)}</p>
          {donnees.active && <Badge ton="positif">{t("Caisse activée")}</Badge>}
        </div>
        <div role="progressbar" aria-valuemin={0} aria-valuemax={donnees.total} aria-valuenow={donnees.faites} aria-label={t("Avancement de la mise en route")} className="mt-2 h-2 overflow-hidden rounded-full bg-[#F0F0F0]">
          <div className="h-full rounded-full bg-[#F5A623] transition-[width]" style={{ width: `${(donnees.faites / donnees.total) * 100}%` }} />
        </div>
      </div>

      {refus && <EtatPos compact code={refus.code} message={refus.message} />}

      <ol className="space-y-3">
        {donnees.etapes.map((e, i) => {
          const def = ETAPES[e.id];
          return (
            <li key={e.id} className={`rounded-2xl border bg-white p-4 ${e.id === prochaine ? "border-[#111111]" : "border-[#E8E8E8]"}`}>
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${e.fait ? "bg-[#ECFDF5] text-[#15803D]" : "bg-[#F5F5F5] text-[#AAAAAA]"}`} aria-hidden>{e.fait ? <Check size={16} /> : <Circle size={14} />}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[14px] font-bold text-[#111111]">
                    {i + 1}. {t(def.titre)}
                    <span className="sr-only">— {t(e.fait ? "fait" : "à faire")}</span>
                    {e.passee && <Badge ton="neutre">{t("Confirmée à la main")}</Badge>}
                    {e.facultative && !e.fait && <Badge ton="neutre">{t("Facultative")}</Badge>}
                  </p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-[#666666]">{t(def.texte)}</p>
                  <p className="mt-1 text-[12px] text-[#888888]">{e.detail}</p>
                  {e.id === "activation" ? (
                    <div className="mt-3">
                      <p className="text-[12.5px] text-[#666666]">{t("Fonctions allumées pour « {0} » :", t(modele.libelle))} {donnees.flagsActivation.map((f) => t(EXPLICATION_FLAGS[f].libelle)).join(", ")}.</p>
                      <div className="mt-3"><Bouton onClick={() => void envoyer({ action: "activer" })} charge={envoi === "activation"} disabled={donnees.active}>{t(donnees.active ? "Caisse activée" : "Activer la caisse")}</Bouton></div>
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {def.href && <Bouton href={def.href} variante={e.fait ? "secondaire" : "sombre"} taille="compact">{t(def.action ?? "Ouvrir")}</Bouton>}
                      {e.id === "produits" && <Bouton href="/dashboard/produits/nouveau" variante="secondaire" taille="compact">{t("Créer un produit")}</Bouton>}
                      {def.passer && !e.fait && <Bouton variante="discret" taille="compact" onClick={() => void envoyer({ action: "passer", etape: e.id })} charge={envoi === e.id}>{t(def.passer)}</Bouton>}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <Carte titre="Écrans utiles à votre commerce">
        <p className="mb-3 text-[12.5px] text-[#666666]">{t(modele.description)}</p>
        <div className="flex flex-wrap gap-2">{modele.fonctions.map((f) => <Bouton key={f.href} href={f.href} variante="secondaire" taille="compact">{t(f.libelle)}</Bouton>)}</div>
        {modele.limites && <p role="note" className="mt-3 rounded-xl border border-[#FCD34D] bg-[#FFFBEB] px-3 py-2 text-[12.5px] text-[#B45309]">{t(modele.limites)}</p>}
      </Carte>

      <VisiteDemo ouverte={demo} onFermer={() => setDemo(false)} />
    </Page>
  );
}
