// État des intégrations : quelles variables d'environnement sont renseignées sur
// ce serveur, et ce que chacune active. Réservé au super-admin ; aucune valeur n'est affichée.
import { redirect } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { getAdminSessionPour } from "@/lib/admin-auth";
import { etatIntegrations } from "@/lib/integrations";
import { getT } from "@/lib/i18n/serveur";

export const dynamic = "force-dynamic";

export default async function AdminIntegrationsPage() {
  const session = await getAdminSessionPour("integrations");
  if (!session) redirect("/admin?refus=1");
  const t = await getT();
  const etats = etatIntegrations();
  const manquantes = etats.filter((e) => !e.active);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white">{t("État des intégrations")}</h1>
        <p className="text-sm mt-1" style={{ color: "#AAAAAA" }}>
          {t("Ce que ce serveur a de configuré. Les valeurs ne sont jamais affichées : elles se règlent dans Vercel → Settings → Environment Variables, puis un redéploiement.")}
        </p>
      </div>
      <p className="text-sm font-semibold" style={{ color: manquantes.some((e) => e.indispensable) ? "#F87171" : "#F5A623" }}>
        {manquantes.length === 0 ? t("Tout est configuré.")
          : manquantes.some((e) => e.indispensable) ? t("Une intégration indispensable est incomplète : l'application ne peut pas fonctionner correctement.")
          : t("{0} fonction(s) facultative(s) non configurée(s) : elles sont masquées ou marquées « bientôt disponible » pour les marchands.", manquantes.length)}
      </p>
      <div className="rounded-2xl border overflow-x-auto" style={{ borderColor: "rgba(255,255,255,0.08)", background: "#1A1A1A" }}>
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="text-left" style={{ color: "#888888" }}>
              <th className="px-4 py-3 font-semibold">{t("Intégration")}</th>
              <th className="px-4 py-3 font-semibold">{t("Ce qu'elle active")}</th>
              <th className="px-4 py-3 font-semibold">{t("Variables")}</th>
            </tr>
          </thead>
          <tbody>
            {etats.map((e) => (
              <tr key={e.cle} className="border-t align-top" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <td className="px-4 py-3 font-semibold text-white">
                  {t(e.nom)}
                  <span className="block text-xs font-normal" style={{ color: e.indispensable ? "#F5A623" : "#888888" }}>{t(e.indispensable ? "Indispensable" : "Facultative")}</span>
                </td>
                <td className="px-4 py-3" style={{ color: "#CCCCCC" }}>{t(e.fonction)}</td>
                <td className="px-4 py-3">
                  <ul className="space-y-1">
                    {e.variables.map((v) => (
                      <li key={v.nom} className="flex items-center gap-2" style={{ color: v.configuree ? "#4ADE80" : "#F87171" }}>
                        {v.configuree ? <CheckCircle2 size={14} aria-hidden /> : <XCircle size={14} aria-hidden />}
                        <code className="text-xs">{v.nom}</code>
                        <span className="text-xs">{t(v.configuree ? "configurée" : "absente")}</span>
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
