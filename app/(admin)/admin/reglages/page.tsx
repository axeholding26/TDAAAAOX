import Link from "next/link";
import { contexteCC } from "@/lib/command-center/serveur";
import { METRIQUES } from "@/lib/command-center/moteur";
import { lien } from "@/lib/command-center/contexte";
import { peutReglerCC, NOM_ROLE } from "@/lib/command-center/rbac";
import { EnTetePage, Carte, Note, Tableau, Badge } from "@/components/command-center/ui";
import { EditeurSeuils, EditeurObjectifs, EditeurPoids, EditeurActivation, type MetriqueOption } from "./Editeurs";

const UNITE = { xaf: "FCFA", nombre: "Nombre", pct: "Pourcentage", heures: "Heures", ratio: "Ratio" };

export default async function Reglages({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const c = await contexteCC("reglages", searchParams);
  const { reglages: r, session, filtres } = c;
  const lecture = !peutReglerCC(session.role);
  const metriques: MetriqueOption[] = METRIQUES.map((m) => ({ id: m.id, nom: m.nom, format: m.format }));

  return (
    <div className="space-y-5">
      <EnTetePage eyebrow="Configuration" titre="Réglages" sousTitre="Seuils d'alerte, objectifs, Health Score, activation et définitions des métriques." />
      {lecture
        ? <Note>Lecture seule : votre rôle ({NOM_ROLE[session.role]}) peut consulter les réglages mais seuls le Super admin et le CEO peuvent les modifier.</Note>
        : <Note>Chaque modification est validée côté serveur et journalisée (avant / après) dans le <Link href="/admin/audit?action=reglage" className="underline">Journal d&apos;audit</Link>.</Note>}

      <Carte id="seuils" titre="Seuils d'alerte" sousTitre="Évalués sur la période des filtres ; un seuil franchi devient une alerte dans Risques & alertes.">
        <EditeurSeuils initial={r.seuils} metriques={metriques} lecture={lecture} />
      </Carte>

      <div className="grid gap-3 xl:grid-cols-2">
        <Carte id="objectifs" titre="Objectifs (Axso Goals)" sousTitre="Métriques de flux mesurées sur 30 jours, métriques de stock à aujourd'hui.">
          <EditeurObjectifs initial={r.objectifs} metriques={metriques} lecture={lecture} />
        </Carte>
        <div className="grid gap-3 content-start">
          <Carte id="sante" titre="Health Score marchand" sousTitre="Poids des 8 critères du score santé (radar churn, rapport santé).">
            <EditeurPoids initial={r.poids_sante} lecture={lecture} />
          </Carte>
          <Carte id="activation" titre="Étape d'activation" sousTitre="Un marchand est « activé » s'il atteint cette étape dans les 14 jours suivant son inscription.">
            <EditeurActivation initial={r.activation} lecture={lecture} />
          </Carte>
        </div>
      </div>

      <Carte id="metriques" titre="Définitions des métriques" sousTitre="Metrics engine : chaque chiffre du Command Center est calculé à partir de ces définitions, et d'elles seules.">
        <Tableau
          colonnes={[{ cle: "nom", nom: "Métrique · description" }, { cle: "formule", nom: "Formule" }, { cle: "unite", nom: "Unité" }, { cle: "sens", nom: "Sens" }, { cle: "page", nom: "Page" }]}
          lignes={METRIQUES.map((m) => ({
            nom: <div className="min-w-[220px] whitespace-normal"><p className="font-medium">{m.nom}</p><p className="cc-faint text-[11.5px]">{m.description}{m.instant ? " (valeur à un instant)" : ""}</p></div>,
            formule: <span className="cc-muted block min-w-[200px] whitespace-normal">{m.formule}</span>,
            unite: UNITE[m.format],
            sens: <Badge ton={m.sens === 1 ? "good" : "info"}>{m.sens === 1 ? "↑ plus haut = mieux" : "↓ plus bas = mieux"}</Badge>,
            page: <Link href={lien(m.page, filtres)} className="hover:underline" style={{ color: "var(--cc-accent-text)" }}>{m.page.replace("/admin/", "").split("#")[0] || "accueil"}</Link>,
          }))}
        />
        {c.ds.manques.length > 0 && <p className="cc-faint text-[11.5px] mt-3">Domaines sans données dans cette source : {c.ds.manques.join(", ")} — les métriques qui en dépendent (CAC, visiteurs…) s&apos;affichent « — ».</p>}
      </Carte>
    </div>
  );
}
