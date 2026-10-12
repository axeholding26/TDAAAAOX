"use client";
// « Connecter un scanner » : affiche sur le poste le QR code à usage unique que
// le téléphone scanne pour devenir le scanner de CETTE caisse. La fenêtre passe
// d'elle-même à « connecté » quand le téléphone a échangé son code (événement
// `device.connected` du flux) — rien à valider sur le poste.
//
//   <ModaleAppairage ouverte={ouverte} onFermer={() => setOuverte(false)} caisseId={caisseId} caisseNom="Caisse 1" />
//
// Props :
// - ouverte, onFermer
// - caisseId   : caisse à laquelle relier le téléphone (défaut : la caisse de travail résolue par le serveur).
// - caisseNom  : nom affiché dans les consignes (facultatif).
// - onConnecte({ appareilId, nom }) : appelé quand le téléphone est connecté.
// Droit exigé par le serveur : gerer_appareils. Le code vaut 5 minutes et ne sert qu'une fois.
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { Bouton, EtatChargement, EtatPos, Modale, TONS } from "@/components/pos/ui";
import { useFluxPos } from "./useFluxPos";

type Appairage = { appareilId: string; url: string; qr: string; expireAt: string };
type Phase =
  | { nom: "chargement" }
  | { nom: "attente"; appairage: Appairage }
  | { nom: "expire" }
  | { nom: "connecte"; appareil: string }
  | { nom: "erreur"; code: string; message: string };

export default function ModaleAppairage({ ouverte, onFermer, caisseId, caisseNom, onConnecte }: {
  ouverte: boolean; onFermer: () => void; caisseId?: string | null; caisseNom?: string;
  onConnecte?: (appareil: { appareilId: string; nom: string }) => void;
}) {
  const t = useT();
  const [phase, setPhase] = useState<Phase>({ nom: "chargement" });
  const [reste, setReste] = useState(0);
  const demande = useRef(0);

  const demander = useCallback(async () => {
    const moi = ++demande.current;
    setPhase({ nom: "chargement" });
    let suite: Phase;
    try {
      const r = await fetch("/api/pos/scanner/appairage", {
        method: "POST", headers: { "Content-Type": "application/json", ...(caisseId ? { "x-pos-caisse": caisseId } : {}) }, body: "{}",
      });
      const corps = await r.json().catch(() => ({}));
      suite = r.ok
        ? { nom: "attente", appairage: corps }
        : { nom: "erreur", code: corps.code ?? "erreur_serveur", message: corps.error ?? "Le code d'appairage n'a pas pu être créé. Réessayez." };
    } catch {
      suite = { nom: "erreur", code: "hors_ligne", message: "Connexion interrompue. L'appairage d'un téléphone a besoin du réseau." };
    }
    // Une demande plus récente (ou la fermeture) a pris la main : on n'affiche pas ce code.
    if (moi === demande.current) setPhase(suite);
  }, [caisseId]);

  useEffect(() => {
    if (ouverte) void demander();
    else demande.current++;
  }, [ouverte, demander]);

  // Compte à rebours du code.
  const expireAt = phase.nom === "attente" ? phase.appairage.expireAt : null;
  useEffect(() => {
    if (!expireAt) return;
    const battre = () => {
      const s = Math.max(0, Math.ceil((new Date(expireAt).getTime() - Date.now()) / 1000));
      setReste(s);
      if (s === 0) setPhase({ nom: "expire" });
    };
    battre();
    const i = setInterval(battre, 1000);
    return () => clearInterval(i);
  }, [expireAt]);

  const attendu = phase.nom === "attente" ? phase.appairage.appareilId : null;
  const { etat } = useFluxPos({
    caisseId, actif: ouverte,
    surEvenement: (e) => {
      if (e.type !== "device.connected" || !attendu || e.payload.appareilId !== attendu) return;
      const nom = typeof e.payload.nom === "string" ? e.payload.nom : "Scanner";
      setPhase({ nom: "connecte", appareil: nom });
      onConnecte?.({ appareilId: attendu, nom });
    },
  });

  const local = phase.nom === "attente" && /\/\/(localhost|127\.0\.0\.1)/.test(phase.appairage.url);

  return (
    <Modale
      ouverte={ouverte} onFermer={onFermer} titre="Connecter un scanner" taille="md"
      description={caisseNom ? t("Le téléphone deviendra un scanner de la caisse « {0} ».", caisseNom) : "Le téléphone deviendra un scanner de cette caisse."}
      actions={
        <>
          {(phase.nom === "attente" || phase.nom === "expire") && <Bouton variante="secondaire" icone={<RefreshCw size={15} aria-hidden />} onClick={() => void demander()}>{t("Nouveau code")}</Bouton>}
          <Bouton variante={phase.nom === "connecte" ? "primaire" : "secondaire"} onClick={onFermer}>{t(phase.nom === "connecte" ? "Terminer" : "Fermer")}</Bouton>
        </>
      }
    >
      {phase.nom === "chargement" && <EtatChargement texte="Préparation du code…" compact />}

      {phase.nom === "erreur" && <EtatPos code={phase.code} message={phase.message} onReessayer={phase.code === "non_autorise" || phase.code === "fonction_desactivee" ? undefined : () => void demander()} compact />}

      {phase.nom === "expire" && (
        <div role="status" className="rounded-2xl border border-dashed border-[#E8E8E8] px-5 py-8 text-center">
          <p className="text-[14px] font-bold">{t("Ce code a expiré")}</p>
          <p className="mt-1.5 text-[12.5px] text-[#666666]">{t("Un code d'appairage n'est valable que 5 minutes. Affichez-en un nouveau.")}</p>
        </div>
      )}

      {phase.nom === "attente" && (
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="h-52 w-52 shrink-0 rounded-2xl border border-[#E8E8E8] bg-white p-3" role="img" aria-label={t("QR code d'appairage")} dangerouslySetInnerHTML={{ __html: phase.appairage.qr }} />
          <div className="min-w-0 flex-1 text-[13px] leading-relaxed text-[#111111]">
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>{t("Ouvrez l'appareil photo du téléphone.")}</li>
              <li>{t("Visez ce QR code et ouvrez le lien proposé.")}</li>
              <li>{t("Autorisez la caméra : le téléphone est prêt à scanner.")}</li>
            </ol>
            <p className="mt-3 text-[12px] text-[#666666]" role="timer">
              {t("Code valable encore {0}", `${Math.floor(reste / 60)}:${String(reste % 60).padStart(2, "0")}`)} · {t("utilisable une seule fois")}
            </p>
            <p className="mt-1 text-[12px] text-[#666666]" role="status">
              {etat === "en_ligne" || etat === "repli" ? t("En attente du téléphone…") : t("Connexion au temps réel en cours : la confirmation peut tarder quelques secondes.")}
            </p>
            {local && (
              <p className="mt-3 rounded-xl px-3 py-2 text-[12px]" style={TONS.attention}>
                {t("Cette caisse est ouverte sur une adresse locale (localhost) : un téléphone ne peut pas l'atteindre. Ouvrez la caisse sur son adresse publique en https pour appairer un téléphone.")}
              </p>
            )}
          </div>
        </div>
      )}

      {phase.nom === "connecte" && (
        <div role="status" className="flex flex-col items-center px-5 py-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full" style={TONS.positif} aria-hidden><CheckCircle2 size={24} /></span>
          <p className="mt-3 text-[15px] font-bold">{t("Scanner connecté")}</p>
          <p className="mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-[#666666]">
            {t("« {0} » est relié à cette caisse. Chaque article scanné sur le téléphone arrive ici tout seul.", phase.appareil)}
          </p>
        </div>
      )}
    </Modale>
  );
}
