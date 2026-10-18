import Link from "next/link";
import { FileText, Printer, Download, FileSpreadsheet } from "lucide-react";
import { contexteCC } from "@/lib/command-center/serveur";
import { lien } from "@/lib/command-center/contexte";
import { peutVoir, peutReglerCC } from "@/lib/command-center/rbac";
import { TYPES_RAPPORT, INFO_RAPPORT } from "@/lib/command-center/rapports";
import { EnTetePage, Carte, Badge, Note } from "@/components/command-center/ui";
import { Programmer } from "./client";
import { getT } from "@/lib/i18n/serveur";

const NOM_FREQ = { quotidien: "chaque jour", hebdomadaire: "chaque lundi", mensuel: "le 1er du mois" };

export default async function Rapports({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const c = await contexteCC("rapports", searchParams);
  const tx = await getT();
  const { filtres, session, reglages } = c;
  const regler = peutReglerCC(session.role);
  const types = TYPES_RAPPORT.filter((t) => peutVoir(session.role, INFO_RAPPORT[t].section));
  const L = (p: string) => lien(p, filtres);

  return (
    <div className="space-y-5">
      <EnTetePage eyebrow="Reports" titre={tx("Rapports")} sousTitre={tx("Rapports exécutifs prêts à imprimer, exporter ou recevoir par e-mail.")} />
      {!regler && <Note>{tx("La programmation des envois est réservée au Super admin et au CEO.")}</Note>}
      <Carte pad={false}>
        <ul className="divide-y cc-sep">
          {types.map((t) => {
            const info = INFO_RAPPORT[t];
            const p = reglages.rapports.find((x) => x.type === t);
            return (
              <li key={t} className="px-4 py-3.5 flex flex-wrap items-center gap-x-4 gap-y-2">
                <FileText size={16} className="cc-faint shrink-0" aria-hidden />
                <div className="min-w-0 flex-1 basis-60">
                  <Link href={L(`/admin/rapports/${t}`)} className="text-[13.5px] font-medium hover:underline">{tx(info.titre)}</Link>
                  <p className="cc-faint text-[12px]">{tx(info.description)} {info.frequence ? <span>{tx("Période : {0}.", tx(info.frequence === "quotidien" ? "hier" : info.frequence === "hebdomadaire" ? "7 derniers jours" : "mois écoulé"))}</span> : <span>{tx("Période : celle des filtres.")}</span>}</p>
                </div>
                {p ? <Badge ton={p.actif ? "good" : "neutre"} titre={regler ? p.destinataires.join(", ") : undefined}>{tx(p.actif ? "Programmé" : "En pause")} · {tx(NOM_FREQ[p.frequence])} · {tx(p.destinataires.length > 1 ? "{0} destinataires" : "{0} destinataire", p.destinataires.length)}</Badge> : <Badge>{tx("Non programmé")}</Badge>}
                <div className="flex flex-wrap items-center gap-1 cc-no-print">
                  <Link href={L(`/admin/rapports/${t}`)} className="cc-btn cc-btn-sm">{tx("Ouvrir")}</Link>
                  <Link href={L(`/admin/rapports/${t}?imprimer=1`)} className="cc-btn cc-btn-ghost cc-btn-sm" aria-label={tx("{0} en PDF", tx(info.titre))}><Printer size={13} />PDF</Link>
                  <Link href={L(`/admin/rapports/${t}?export=csv`)} className="cc-btn cc-btn-ghost cc-btn-sm" aria-label={tx("{0} en CSV", tx(info.titre))}><Download size={13} />CSV</Link>
                  <Link href={L(`/admin/rapports/${t}?export=xlsx`)} className="cc-btn cc-btn-ghost cc-btn-sm" aria-label={tx("{0} en Excel", tx(info.titre))}><FileSpreadsheet size={13} />Excel</Link>
                  {regler && <Programmer type={t} planifies={reglages.rapports} frequenceParDefaut={info.frequence ?? "hebdomadaire"} />}
                </div>
              </li>
            );
          })}
        </ul>
      </Carte>
      <p className="cc-faint text-[11.5px]">{tx("Les rapports envoyés par e-mail portent toujours sur les données réelles. Chaque programmation est journalisée dans le Journal d'audit.")}</p>
    </div>
  );
}
