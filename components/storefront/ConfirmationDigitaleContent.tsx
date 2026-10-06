import Link from "next/link";
import { CheckCircle, XCircle, Download, Zap, Package, MessageCircle, Check, X, GraduationCap, KeyRound } from "lucide-react";
import { formatMontant, formatDate } from "@/lib/utils";
import { TYPES_LIVRAISON_DIGITALE } from "@/lib/affiliation";
import { CopyableKey } from "@/components/storefront/CopyableKey";
import { LockedDownloads } from "@/components/storefront/LockedDownloads";
import { getT } from "@/lib/i18n/serveur";

// Contenu de la page de confirmation (paiement en ligne — digital/dropshipping/
// mixte), extrait de app/(storefront)/[slug]/confirmation/[orderId]/page.tsx
// pour pouvoir être enchâssé tel quel dans le chrome d'un thème importé/généré
// (voir ImportedLiteralConfirmationShell.tsx) — comportement strictement
// identique à avant, seul le contenu a été déplacé dans son propre composant.
// Ne rend jamais le fond de page/ThemeEffect/footer : ceux-ci restent gérés
// par la page appelante (classique) ou par le chrome cloné.
interface Props {
  theme: { fond: string; accent: string; texte: string; surface: string };
  slug: string;
  devise: string;
  commande: {
    numero: string;
    createdAt: Date;
    clientNom: string;
    montantTotal: number;
    adresseLivraison: string | null;
    ville: string | null;
    trackingToken: string | null;
    lignes: Array<{
      id: string;
      nom: string;
      variante: string | null;
      quantite: number;
      prix: number;
      produit: { id: string; type: string | null; fichierUrl: string | null; fichierNom: string | null } | null;
    }>;
  };
  paye: boolean;
  echoue: boolean;
  isCOD: boolean;
  isDigital: boolean;
  lignesDigitales: Props["commande"]["lignes"];
  // Formes exactes issues de requêtes Prisma avec include variables — typées
  // en any[] volontairement (comme le JSX inline d'origine, jamais typé
  // strictement ici) plutôt que de dupliquer les types Prisma générés.
  telechargements: readonly any[];
  accesFormations: readonly any[];
  clesLicence: readonly any[];
  nomProduit: Map<string, string>;
}

export async function ConfirmationDigitaleContent({
  theme, slug, devise, commande, paye, echoue, isCOD, isDigital,
  lignesDigitales, telechargements, accesFormations, clesLicence, nomProduit,
}: Props) {
  const t = await getT();
  return (
    <div className="max-w-2xl mx-auto px-4 py-16">

      {/* ── En-tête statut ─────────────────────────────────────────── */}
      {echoue ? (
        <div className="text-center mb-10">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ backgroundColor: "rgba(239,68,68,0.15)", border: "2px solid rgba(239,68,68,0.4)" }}>
            <XCircle size={36} className="text-red-400" />
          </div>
          <h1 className="text-2xl font-bold font-playfair mb-2 text-red-400">{t("Paiement échoué")}</h1>
          <p className="opacity-60 mb-6">{t("Une erreur est survenue. Votre commande n'a pas été confirmée.")}</p>
          <Link href={commande.lignes[0]?.produit ? `/${slug}/produits/${commande.lignes[0].produit.id}` : `/${slug}/produits`}
            className="px-8 py-3 rounded-xl font-semibold text-sm inline-block"
            style={{ backgroundColor: theme.accent, color: theme.fond }}>
            {t("Réessayer")}
          </Link>
        </div>
      ) : isCOD ? (
        <div className="text-center mb-10">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ backgroundColor: "rgba(16,185,129,0.15)", border: "2px solid rgba(16,185,129,0.4)" }}>
            <Package size={36} className="text-green-400" />
          </div>
          <h1 className="text-3xl font-bold font-playfair mb-2 text-green-400">{t("Commande enregistrée !")}</h1>
          <p className="opacity-70 text-lg mb-1">{t("Merci")}{" "}{t(commande.clientNom)}</p>
          <p className="opacity-40 text-sm">{t("Le vendeur va vous contacter pour organiser la livraison.")}</p>
        </div>
      ) : isDigital ? (
        <div className="text-center mb-10">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ backgroundColor: `${theme.accent}20`, border: `2px solid ${theme.accent}` }}>
            <Zap size={36} style={{ color: theme.accent }} />
          </div>
          <h1 className="text-3xl font-bold font-playfair mb-2" style={{ color: theme.accent }}>
            {paye ? t("Achat confirmé !") : t("Commande reçue !")}
          </h1>
          <p className="opacity-70 text-lg mb-1">{t("Merci")}{" "}{t(commande.clientNom)}{" "}{t("— votre fichier est prêt !")}</p>
          <p className="opacity-40 text-sm">{t("Un lien de téléchargement a été envoyé à votre email.")}</p>
        </div>
      ) : (
        <div className="text-center mb-10">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ backgroundColor: `${theme.accent}20`, border: `2px solid ${theme.accent}` }}>
            <CheckCircle size={36} style={{ color: theme.accent }} />
          </div>
          <h1 className="text-3xl font-bold font-playfair mb-2" style={{ color: theme.accent }}>
            {paye ? t("Commande confirmée !") : t("Commande reçue !")}
          </h1>
          <p className="opacity-70 text-lg mb-1">{t("Merci pour votre commande,")}{" "}{t(commande.clientNom)}</p>
          <p className="opacity-40 text-sm">{t("Un email de confirmation vous a été envoyé.")}</p>
        </div>
      )}

      {/* ── Téléchargements digitaux ──────────────────────────────── */}
      {lignesDigitales.length > 0 && (paye || !echoue) && (
        <div className="rounded-2xl border p-6 mb-4 space-y-4"
          style={{ backgroundColor: theme.surface, borderColor: `${theme.accent}40`, boxShadow: `0 0 0 1px ${theme.accent}20, 0 8px 32px ${theme.accent}12` }}>
          <h3 className="font-bold text-base flex items-center gap-2" style={{ color: theme.accent }}>
            <Download size={16} />{" "}{t("Vos téléchargements")}
          </h3>
          <div className="space-y-3">
            {lignesDigitales.map((ligne) => (
              <div key={ligne.id} className="flex items-center justify-between gap-4 p-3 rounded-xl"
                style={{ backgroundColor: `${theme.accent}08`, border: `1px solid ${theme.accent}20` }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{t(ligne.nom)}</p>
                  <p className="text-xs opacity-50 mt-0.5">{t(ligne.produit?.fichierNom) || t("Fichier digital")}</p>
                </div>
                <a
                  href={ligne.produit!.fichierUrl!}
                  download={ligne.produit?.fichierNom || ligne.nom}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold flex-shrink-0 transition-all hover:opacity-90"
                  style={{ backgroundColor: theme.accent, color: theme.fond }}>
                  <Download size={14} />{" "}{t("Télécharger")}
                </a>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs opacity-50">
            <Zap size={11} style={{ color: theme.accent }} />
            {t("Liens valides 7 jours · Accès depuis votre email également")}
          </div>
        </div>
      )}

      {/* ── Fichiers (nouveau système multi-fichiers) ─────────────── */}
      {telechargements.length > 0 && (paye || !echoue) && (
        <div className="rounded-2xl border p-6 mb-4 space-y-4"
          style={{ backgroundColor: theme.surface, borderColor: `${theme.accent}40`, boxShadow: `0 0 0 1px ${theme.accent}20, 0 8px 32px ${theme.accent}12` }}>
          <h3 className="font-bold text-base flex items-center gap-2" style={{ color: theme.accent }}>
            <Download size={16} />{" "}{t("Vos fichiers")}
          </h3>
          <div className="space-y-3">
            {telechargements.map((dl) => {
              const fichiers = dl.produit.produitFichier?.fichiers ?? [];
              const nom = nomProduit.get(dl.produitId) ?? dl.produit.nom;
              if (fichiers.length === 0) return null;
              if (dl.produit.produitFichier?.motDePasse) {
                return <LockedDownloads key={dl.id} token={dl.token} nom={nom} accent={theme.accent} fond={theme.fond} />;
              }
              return (
                <div key={dl.id} className="p-3 rounded-xl" style={{ backgroundColor: `${theme.accent}08`, border: `1px solid ${theme.accent}20` }}>
                  <p className="text-sm font-semibold mb-2">{t(nom)}</p>
                  <div className="space-y-2">
                    {fichiers.map((f: any) => (
                      <div key={f.id} className="flex items-center justify-between gap-3">
                        <span className="text-xs opacity-60 truncate">{t(f.nom)}</span>
                        <a href={`/api/telechargements/${dl.token}?fichier=${f.id}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold flex-shrink-0 transition-all hover:opacity-90"
                          style={{ backgroundColor: theme.accent, color: theme.fond }}>
                          <Download size={12} />{" "}{t("Télécharger")}
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2 text-xs opacity-50">
            <Zap size={11} style={{ color: theme.accent }} />
            {t("Accès valide 1 an · Retrouvez ce lien dans votre email de confirmation")}
          </div>
        </div>
      )}

      {/* ── Formations ───────────────────────────────────────────── */}
      {accesFormations.length > 0 && (paye || !echoue) && (
        <div className="rounded-2xl border p-6 mb-4 space-y-3"
          style={{ backgroundColor: theme.surface, borderColor: `${theme.accent}40`, boxShadow: `0 0 0 1px ${theme.accent}20, 0 8px 32px ${theme.accent}12` }}>
          <h3 className="font-bold text-base flex items-center gap-2" style={{ color: theme.accent }}>
            <GraduationCap size={16} />{" "}{t("Vos formations")}
          </h3>
          <div className="space-y-3">
            {accesFormations.map((acces) => (
              <div key={acces.id} className="flex items-center justify-between gap-4 p-3 rounded-xl"
                style={{ backgroundColor: `${theme.accent}08`, border: `1px solid ${theme.accent}20` }}>
                <p className="text-sm font-semibold truncate">{nomProduit.get(acces.produitId) ?? t("Formation")}</p>
                <a href={`/${slug}/formation/${acces.token}`}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold flex-shrink-0 transition-all hover:opacity-90"
                  style={{ backgroundColor: theme.accent, color: theme.fond }}>
                  {t("Accéder")}{" "}<GraduationCap size={14} />
                </a>
              </div>
            ))}
          </div>
          <p className="text-xs opacity-50">{t("Accès à vie · Retrouvez ce lien dans votre email de confirmation")}</p>
        </div>
      )}

      {/* ── Licences ─────────────────────────────────────────────── */}
      {clesLicence.length > 0 && (paye || !echoue) && (
        <div className="rounded-2xl border p-6 mb-4 space-y-3"
          style={{ backgroundColor: theme.surface, borderColor: `${theme.accent}40`, boxShadow: `0 0 0 1px ${theme.accent}20, 0 8px 32px ${theme.accent}12` }}>
          <h3 className="font-bold text-base flex items-center gap-2" style={{ color: theme.accent }}>
            <KeyRound size={16} />{" "}{t("Vos clés de licence")}
          </h3>
          <div className="space-y-3">
            {clesLicence.map((cle) => (
              <div key={cle.id} className="flex items-center justify-between gap-4 p-3 rounded-xl"
                style={{ backgroundColor: `${theme.accent}08`, border: `1px solid ${theme.accent}20` }}>
                <p className="text-sm font-semibold truncate">{nomProduit.get(cle.licenceProduit.produitId) ?? t("Licence")}</p>
                <CopyableKey value={cle.cle} accent={theme.accent} fond={theme.fond} />
              </div>
            ))}
          </div>
          <p className="text-xs opacity-50">{t("Conservez précieusement vos clés — elles ne sont affichées qu'une fois.")}</p>
        </div>
      )}

      {/* ── WhatsApp CTA pour COD ─────────────────────────────────── */}
      {isCOD && (
        <div className="rounded-2xl border p-5 mb-4 flex items-center gap-4"
          style={{ backgroundColor: "rgba(37,211,102,0.05)", borderColor: "rgba(37,211,102,0.25)" }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#25D366" }}>
            <MessageCircle size={20} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-green-500">{t("Paiement à la livraison")}</p>
            <p className="text-xs opacity-60 mt-0.5">{t("Vous paierez en espèces ou mobile money à la réception du colis.")}</p>
          </div>
        </div>
      )}

      {/* ── Récapitulatif ─────────────────────────────────────────── */}
      <div className="rounded-2xl border p-6 mb-4 space-y-3"
        style={{ backgroundColor: theme.surface, borderColor: `${theme.accent}20` }}>
        <h3 className="font-semibold text-sm opacity-80 mb-4">{t("Récapitulatif")}</h3>
        <div className="flex justify-between text-sm">
          <span className="opacity-60">{t("N° commande")}</span>
          <span className="font-mono font-bold" style={{ color: theme.accent }}>{commande.numero}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="opacity-60">{t("Date")}</span>
          <span>{formatDate(commande.createdAt)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="opacity-60">{t("Statut paiement")}</span>
          {isCOD ? (
            <span className="text-green-400 font-medium flex items-center gap-1"><Check size={12} />{" "}{t("Paiement à la livraison")}</span>
          ) : (
            <span className={`flex items-center gap-1 ${paye ? "text-green-400 font-medium" : echoue ? "text-red-400 font-medium" : "text-amber-400 font-medium"}`}>
              {paye ? <><Check size={12} />{" "}{t("Payé")}</> : echoue ? <><X size={12} />{" "}{t("Échoué")}</> : t("En attente")}
            </span>
          )}
        </div>
        <div className="flex justify-between">
          <span className="opacity-60 text-sm">{t("Total")}</span>
          <span className="font-bold text-lg" style={{ color: theme.accent }}>{formatMontant(commande.montantTotal, devise)}</span>
        </div>
        {commande.adresseLivraison && commande.adresseLivraison !== "À préciser" && !isDigital && (
          <div className="flex justify-between text-sm">
            <span className="opacity-60">{t("Livraison")}</span>
            <span className="text-right max-w-xs opacity-80">{t(commande.adresseLivraison)}, {t(commande.ville)}</span>
          </div>
        )}
      </div>

      {/* ── Articles ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border p-6 mb-4"
        style={{ backgroundColor: theme.surface, borderColor: `${theme.accent}20` }}>
        <h3 className="font-semibold text-sm opacity-80 mb-4">{t("Articles commandés")}</h3>
        <div className="space-y-3">
          {commande.lignes.map((ligne) => (
            <div key={ligne.id} className="flex items-center justify-between text-sm gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {ligne.produit?.type && TYPES_LIVRAISON_DIGITALE.has(ligne.produit.type)
                  ? <Zap size={12} style={{ color: theme.accent }} className="flex-shrink-0" />
                  : <Package size={12} className="opacity-40 flex-shrink-0" />
                }
                <span className="opacity-80 truncate">
                  {t(ligne.nom)}{ligne.variante ? ` (${ligne.variante})` : ""}{" "}{t("×")}{" "}{ligne.quantite}
                </span>
              </div>
              <span style={{ color: theme.accent }} className="flex-shrink-0">
                {formatMontant(ligne.prix * ligne.quantite, devise)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Actions ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {!isCOD && !isDigital && commande.trackingToken && (
          <Link href={`/${slug}/tracking/${commande.trackingToken}`}
            className="flex-1 text-center px-6 py-3 rounded-xl font-semibold text-sm transition-all border"
            style={{ borderColor: `${theme.accent}40`, color: theme.accent }}>
            {t("Suivre ma commande")}
          </Link>
        )}
        <Link href={`/${slug}/produits`}
          className="flex-1 text-center px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
          style={{ backgroundColor: theme.accent, color: theme.fond }}>
          {t("Continuer les achats")}
        </Link>
      </div>
    </div>
  );
}
