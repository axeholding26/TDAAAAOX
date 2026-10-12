"use client";
// Création / modification d'un fournisseur. Tout ce qui est saisi ici est
// enregistré comme « déclaré par le fournisseur » : aucun champ ne permet de
// se dire vérifié. L'assistant IA ne fait que pré-remplir le formulaire à
// partir d'un texte collé ; rien n'est enregistré avant validation du marchand.
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { Bouton, Champ, CLASSE_CHAMP, Erreur, envoyer } from "@/components/dashboard/sourcing/ui";
import { TYPES_ENTREPRISE } from "@/lib/sourcing/fournisseurs/types";

type Valeurs = Record<string, any>;

const TEXTES: [string, string, string?][] = [
  ["nom", "Nom du fournisseur"], ["pays", "Pays"], ["url", "Site ou page fournisseur", "https://"], ["email", "E-mail"],
  ["telephone", "Téléphone / WhatsApp"], ["adresseUsine", "Adresse de l'usine"], ["capaciteProduction", "Capacité de production", "ex. 50 000 unités / mois"],
  ["equipements", "Équipements"], ["numeroLicence", "Numéro de licence commerciale"], ["protectionPaiement", "Protection de paiement annoncée", "ex. Trade Assurance"],
];
const NOMBRES: [string, string][] = [["anneeCreation", "Année de création"], ["nbEmployes", "Nombre d'employés"], ["delaiLivraison", "Délai de livraison (jours)"]];
const LISTES: [string, string][] = [["categoriesProduites", "Catégories produites"], ["marchesExport", "Marchés d'exportation"]];
const CHOIX: [string, string][] = [
  ["personnalisation", "Personnalisation"], ["privateLabel", "Private label"], ["packagingPerso", "Packaging personnalisé"],
];

export function FormulaireFournisseur({ initial, onEnregistre, onAnnule }: { initial?: Valeurs; onEnregistre: (id: string) => void; onAnnule?: () => void }) {
  const t = useT();
  const [v, setV] = useState<Valeurs>({ pays: "Chine", typeEntreprise: "inconnu", ...initial });
  const [texte, setTexte] = useState("");
  // Offre et certifications lues par l'IA : créées avec le fournisseur, toujours « déclarées ».
  const [extras, setExtras] = useState<{ offre?: Valeurs; certifications: string[] }>({ certifications: [] });
  const [charge, setCharge] = useState<"" | "ia" | "envoi">("");
  const [erreur, setErreur] = useState("");
  const champ = (cle: string) => ({ value: v[cle] ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV({ ...v, [cle]: e.target.value }), className: CLASSE_CHAMP });

  async function extraire() {
    setCharge("ia"); setErreur("");
    try {
      const { fiche } = await envoyer("/api/fournisseurs/ia", "POST", { action: "extraire", texte });
      const { offre, certificationsDeclarees, ...reste } = fiche;
      setV((a) => ({ ...a, ...Object.fromEntries(Object.entries(reste).filter(([, x]) => x !== undefined && !(Array.isArray(x) && !x.length))) }));
      setExtras({ offre: offre?.nomProduit && offre?.prixUnitaire ? offre : undefined, certifications: certificationsDeclarees ?? [] });
    } catch (e) { setErreur((e as Error).message); }
    setCharge("");
  }

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setCharge("envoi"); setErreur("");
    const liste = (x: unknown) => (Array.isArray(x) ? x : String(x ?? "").split(",").map((s) => s.trim()).filter(Boolean));
    const corps = { ...v, categoriesProduites: liste(v.categoriesProduites), marchesExport: liste(v.marchesExport) };
    try {
      const id = initial?.id
        ? (await envoyer(`/api/fournisseurs/${initial.id}`, "PATCH", corps), initial.id as string)
        : (await envoyer("/api/fournisseurs", "POST", corps)).fournisseur.id as string;
      if (extras.offre) await envoyer(`/api/fournisseurs/${id}/offres`, "POST", extras.offre);
      for (const c of extras.certifications) await envoyer(`/api/fournisseurs/${id}/documents`, "POST", { type: "certificat", certification: c, nom: c });
      onEnregistre(id);
    } catch (e) { setErreur((e as Error).message); }
    setCharge("");
  }

  return (
    <form onSubmit={enregistrer} className="space-y-4">
      {!initial?.id && (
        <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-3 space-y-2">
          <p className="text-[12px] font-bold text-[#111111] flex items-center gap-1.5"><Sparkles size={13} className="text-[#B45309]" />{t("Pré-remplir à partir d'un texte")}</p>
          <p className="text-[11px] text-[#666666] leading-snug">{t("Collez la page du fournisseur, son message ou son catalogue : l'assistant remplit le formulaire. Vous vérifiez, puis vous enregistrez. Ces informations restent « déclarées par le fournisseur ».")}</p>
          <textarea rows={3} value={texte} onChange={(e) => setTexte(e.target.value)} className={CLASSE_CHAMP} placeholder={t("Texte copié depuis la page ou le message du fournisseur…")} />
          <Bouton petit variante="discret" onClick={extraire} charge={charge === "ia"} disabled={texte.trim().length < 20}>{t("Extraire les informations")}</Bouton>
          {(extras.offre || extras.certifications.length > 0) && (
            <p className="text-[11px] text-[#666666]">
              {extras.offre && t("Offre lue : {0} à {1} {2}.", extras.offre.nomProduit, extras.offre.prixUnitaire, extras.offre.devise ?? "USD")}{" "}
              {extras.certifications.length > 0 && t("Certifications annoncées (sans document) : {0}.", extras.certifications.join(", "))}{" "}
              {t("Elles seront créées avec le fournisseur.")}
            </p>
          )}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {TEXTES.slice(0, 5).map(([cle, label, ph]) => <Champ key={cle} label={label}><input {...champ(cle)} placeholder={ph} required={cle === "nom"} /></Champ>)}
        <Champ label="Type d'entreprise" aide="Tel que le fournisseur se présente. AXSO le confronte ensuite aux indices disponibles.">
          <select {...champ("typeEntreprise")}>{Object.entries(TYPES_ENTREPRISE).map(([cle, l]) => <option key={cle} value={cle}>{t(l)}</option>)}</select>
        </Champ>
        {NOMBRES.map(([cle, label]) => <Champ key={cle} label={label}><input type="number" min={0} {...champ(cle)} /></Champ>)}
        {TEXTES.slice(5).map(([cle, label, ph]) => <Champ key={cle} label={label}><input {...champ(cle)} placeholder={ph ? t(ph) : undefined} /></Champ>)}
        {LISTES.map(([cle, label]) => (
          <Champ key={cle} label={label} aide="Séparées par des virgules">
            <input className={CLASSE_CHAMP} value={Array.isArray(v[cle]) ? v[cle].join(", ") : v[cle] ?? ""} onChange={(e) => setV({ ...v, [cle]: e.target.value })} />
          </Champ>
        ))}
        {CHOIX.map(([cle, label]) => (
          <Champ key={cle} label={label}>
            <select className={CLASSE_CHAMP} value={v[cle] === true ? "oui" : v[cle] === false ? "non" : ""} onChange={(e) => setV({ ...v, [cle]: e.target.value === "" ? null : e.target.value === "oui" })}>
              <option value="">{t("Inconnu")}</option><option value="oui">{t("Oui")}</option><option value="non">{t("Non")}</option>
            </select>
          </Champ>
        ))}
      </div>
      <Champ label="Notes"><textarea rows={2} {...champ("notes")} /></Champ>

      {erreur && <Erreur message={erreur} />}
      <div className="flex gap-2 justify-end">
        {onAnnule && <Bouton variante="secondaire" onClick={onAnnule}>{t("Annuler")}</Bouton>}
        <Bouton type="submit" charge={charge === "envoi"}>{t(initial?.id ? "Enregistrer" : "Ajouter le fournisseur")}</Bouton>
      </div>
    </form>
  );
}
