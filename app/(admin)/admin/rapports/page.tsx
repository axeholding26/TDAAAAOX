import Link from "next/link";
import { FileText, Printer, Download, FileSpreadsheet } from "lucide-react";
import { contexteCC } from "@/lib/command-center/serveur";
import { lien } from "@/lib/command-center/contexte";
import { peutVoir, peutReglerCC } from "@/lib/command-center/rbac";
import { TYPES_RAPPORT, INFO_RAPPORT } from "@/lib/command-center/rapports";
import { EnTetePage, Carte, Badge, Note } from "@/components/command-center/ui";
import { Programmer } from "./client";

const NOM_FREQ = { quotidien: "chaque jour", hebdomadaire: "chaque lundi", mensuel: "le 1er du mois" };

export default async function Rapports({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const c = await contexteCC("rapports", searchParams);
  const { filtres, session, reglages } = c;
  const regler = peutReglerCC(session.role);
  const types = TYPES_RAPPORT.filter((t) => peutVoir(session.role, INFO_RAPPORT[t].section));
  const L = (p: string) => lien(p, filtres);

  return (
    <div className="space-y-5">
      <EnTetePage eyebrow="Reports" titre="Rapports" sousTitre="Rapports exécutifs prêts à imprimer, exporter ou recevoir par e-mail." />
      {!regler && <Note>La programmation des envois est réservée au Super admin et au CEO.</Note>}
      <Carte pad={false}>
        <ul className="divide-y cc-sep">
          {types.map((t) => {
            const info = INFO_RAPPORT[t];
            const p = reglages.rapports.find((x) => x.type === t);
            return (
              <li key={t} className="px-4 py-3.5 flex flex-wrap items-center gap-x-4 gap-y-2">
                <FileText size={16} className="cc-faint shrink-0" aria-hidden />
                <div className="min-w-0 flex-1 basis-60">
                  <Link href={L(`/admin/rapports/${t}`)} className="text-[13.5px] font-medium hover:underline">{info.titre}</Link>
                  <p className="cc-faint text-[12px]">{info.description} {info.frequence ? <span>Période : {info.frequence === "quotidien" ? "hier" : info.frequence === "hebdomadaire" ? "7 derniers jours" : "mois écoulé"}.</span> : <span>Période : celle des filtres.</span>}</p>
                </div>
                {p ? <Badge ton={p.actif ? "good" : "neutre"} titre={regler ? p.destinataires.join(", ") : undefined}>{p.actif ? "Programmé" : "En pause"} · {NOM_FREQ[p.frequence]} · {p.destinataires.length} destinataire{p.destinataires.length > 1 ? "s" : ""}</Badge> : <Badge>Non programmé</Badge>}
                <div className="flex flex-wrap items-center gap-1 cc-no-print">
                  <Link href={L(`/admin/rapports/${t}`)} className="cc-btn cc-btn-sm">Ouvrir</Link>
                  <Link href={L(`/admin/rapports/${t}?imprimer=1`)} className="cc-btn cc-btn-ghost cc-btn-sm" aria-label={`${info.titre} en PDF`}><Printer size={13} />PDF</Link>
                  <Link href={L(`/admin/rapports/${t}?export=csv`)} className="cc-btn cc-btn-ghost cc-btn-sm" aria-label={`${info.titre} en CSV`}><Download size={13} />CSV</Link>
                  <Link href={L(`/admin/rapports/${t}?export=xlsx`)} className="cc-btn cc-btn-ghost cc-btn-sm" aria-label={`${info.titre} en Excel`}><FileSpreadsheet size={13} />Excel</Link>
                  {regler && <Programmer type={t} planifies={reglages.rapports} frequenceParDefaut={info.frequence ?? "hebdomadaire"} />}
                </div>
              </li>
            );
          })}
        </ul>
      </Carte>
      <p className="cc-faint text-[11.5px]">Les rapports envoyés par e-mail portent toujours sur les données réelles. Chaque programmation est journalisée dans le Journal d'audit.</p>
    </div>
  );
}
