"use client";
// Association d'un client à la vente : recherche (nom, téléphone, code client)
// ou QR de la carte client, et création rapide. S'appuie sur /api/pos/clients :
//   GET ?q= → { clients } ; POST { nom, telephone } → { client }, ou 409
//   « client_existant » avec le client déjà connu dans details.client.
// Si la route n'existe pas sur ce serveur, le tiroir le dit — la vente reste
// possible sans client (« Client comptoir »).
import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { Badge, Bouton, EtatChargement, EtatPos, EtatVide, FOCUS, Saisie, Tiroir } from "@/components/pos/ui";
import { appelPos } from "./api";
import { versClientCaisse, type ClientCaisse } from "./logique";

export function SelecteurClient({ caisseId, peutCreer, onChoisir, onFermer }: {
  caisseId: string | null;
  /** Droit « vendre » ou « gerer_clients ». */
  peutCreer: boolean;
  onChoisir: (client: ClientCaisse) => void;
  onFermer: () => void;
}) {
  const t = useT();
  const { fmt } = useDevise();
  const [q, setQ] = useState("");
  const [clients, setClients] = useState<ClientCaisse[]>([]);
  const [etat, setEtat] = useState<"chargement" | "pret" | { code: string; message: string }>("chargement");
  const [essai, setEssai] = useState(0);
  const [creation, setCreation] = useState(false);
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [existant, setExistant] = useState<ClientCaisse | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const minuterie = setTimeout(async () => {
      setEtat("chargement");
      const r = await appelPos<{ clients?: unknown[] }>(`/api/pos/clients?q=${encodeURIComponent(q.trim())}`, { caisseId, signal: ctrl.signal });
      if (ctrl.signal.aborted || (!r.ok && r.code === "annule")) return;
      if (!r.ok) return setEtat({ code: r.code, message: r.message });
      setClients((r.donnees.clients ?? []).map(versClientCaisse).filter((c): c is ClientCaisse => c !== null));
      setEtat("pret");
    }, q.trim() ? 250 : 0);
    return () => { clearTimeout(minuterie); ctrl.abort(); };
  }, [q, caisseId, essai]);

  const creer = async () => {
    if (nom.trim().length < 2) return setErreur("Indiquez le nom du client (au moins 2 caractères).");
    if (telephone.trim().length < 6) return setErreur("Indiquez le numéro de téléphone du client.");
    setEnvoi(true); setErreur(null); setExistant(null);
    const r = await appelPos<{ client?: unknown }>("/api/pos/clients", { method: "POST", caisseId, corps: { nom: nom.trim(), telephone: telephone.trim() } });
    setEnvoi(false);
    if (!r.ok) {
      // Téléphone déjà connu : on propose le client existant plutôt qu'un doublon.
      if (r.code === "client_existant") setExistant(versClientCaisse(r.details?.client));
      return setErreur(r.message);
    }
    const cree = versClientCaisse(r.donnees.client);
    if (!cree) return setErreur("Le client a été créé, mais la caisse n'a pas pu le relire. Recherchez-le par son nom.");
    onChoisir(cree);
  };

  const indisponible = typeof etat === "object" && etat.code === "indisponible";

  return (
    <Tiroir ouverte onFermer={onFermer} titre="Client de la vente" description="Recherchez un client par son nom, son téléphone ou son code client, ou scannez sa carte dans le champ.">
      <div className="space-y-3">
        <Saisie label="Rechercher un client" labelMasque type="search" autoFocus autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Nom, téléphone ou code client…")} disabled={indisponible} />

        {etat === "chargement" ? <EtatChargement compact texte="Recherche des clients…" />
          : indisponible ? <EtatVide compact titre="Fichier clients indisponible" texte="La recherche de clients n'est pas encore active sur cette caisse. Vous pouvez encaisser sans client : la vente sera enregistrée au nom de « Client comptoir »." />
          : typeof etat === "object" ? <EtatPos compact code={etat.code} message={etat.message} onReessayer={() => setEssai((n) => n + 1)} />
          : clients.length === 0 ? <EtatVide compact titre={q.trim() ? "Aucun client ne correspond" : "Aucun client enregistré"} texte={peutCreer ? "Créez sa fiche ci-dessous en quelques secondes." : undefined} />
          : (
            <ul className="space-y-1.5">
              {clients.map((c) => {
                const disponible = c.creditPlafond != null && c.creditPlafond > 0 ? Math.max(0, c.creditPlafond - (c.creditUtilise ?? 0)) : null;
                return (
                  <li key={c.id}>
                    <button type="button" onClick={() => onChoisir(c)} className={cn("flex min-h-14 w-full flex-col justify-center rounded-xl border border-[#E8E8E8] bg-white px-3 py-2 text-left transition-colors hover:border-[#F5A623]", FOCUS)}>
                      <span className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold text-[#111111]">
                        {c.nom}
                        {c.niveauFidelite && c.pointsFidelite != null && <Badge ton="accent">{c.niveauFidelite} · {c.pointsFidelite} {t("points")}</Badge>}
                        {c.creditBloque && <Badge ton="danger">{t("Crédit bloqué")}</Badge>}
                      </span>
                      <span className="text-[11.5px] text-[#666666]">
                        {[c.telephone, c.codeClient, c.segment, disponible !== null ? t("Crédit disponible : {0}", fmt(disponible)) : null].filter(Boolean).join(" · ") || t("Aucune coordonnée")}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

        {peutCreer && !indisponible && (creation ? (
          <form className="space-y-3 rounded-2xl border border-[#E8E8E8] p-3" onSubmit={(e) => { e.preventDefault(); creer(); }}>
            <Saisie label="Nom du client" autoFocus value={nom} onChange={(e) => setNom(e.target.value)} maxLength={120} autoComplete="off" />
            <Saisie label="Téléphone" type="tel" inputMode="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} maxLength={30} autoComplete="off" aide="Il sert à retrouver le client et à éviter les doublons." />
            {erreur && <p role="alert" className="text-[12.5px] leading-snug text-[#B91C1C]">{t(erreur)}</p>}
            {existant && <Bouton variante="discret" large onClick={() => onChoisir(existant)}>{t("Associer {0} à la vente", existant.nom)}</Bouton>}
            <div className="flex justify-end gap-2">
              <Bouton variante="secondaire" onClick={() => { setCreation(false); setErreur(null); }} disabled={envoi}>{t("Annuler")}</Bouton>
              <Bouton type="submit" charge={envoi}>{t("Créer et associer")}</Bouton>
            </div>
          </form>
        ) : (
          <Bouton variante="discret" large onClick={() => { setCreation(true); setNom(/^\+?[\d\s]+$/.test(q.trim()) ? "" : q.trim()); setTelephone(/^\+?[\d\s]+$/.test(q.trim()) ? q.trim() : ""); }} icone={<UserPlus size={16} aria-hidden />}>{t("Nouveau client")}</Bouton>
        ))}
      </div>
    </Tiroir>
  );
}
