import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { contexteCC } from "@/lib/command-center/serveur";
import { EnTetePage, Carte, EtatVide, Note } from "@/components/command-center/ui";
import { getT } from "@/lib/i18n/serveur";

const PAR_PAGE = 50;
const un = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.slice(0, 120) || undefined;

export default async function Audit({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  await contexteCC("audit", sp);
  const t = await getT();
  const action = un(sp.action), admin = un(sp.admin);
  const page = Math.max(1, Math.min(1000, Number(un(sp.page)) || 1));
  // Filtre « action » par préfixe : « reglage » couvre reglage.seuils, reglage.objectifs…
  const where = { ...(action ? { action: { startsWith: action } } : {}), ...(admin ? { adminEmail: admin } : {}) };

  const [lignes, total, actions, admins] = await Promise.all([
    prisma.auditAdmin.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAR_PAGE, take: PAR_PAGE }),
    prisma.auditAdmin.count({ where }),
    prisma.auditAdmin.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" }, take: 200 }),
    prisma.auditAdmin.findMany({ distinct: ["adminEmail"], select: { adminEmail: true }, orderBy: { adminEmail: "asc" }, take: 200 }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAR_PAGE));
  const href = (p: number) => `/admin/audit?${new URLSearchParams({ ...(action ? { action } : {}), ...(admin ? { admin } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`;
  const json = (x: unknown) => (x == null ? "—" : JSON.stringify(x, null, 2));

  return (
    <div className="space-y-5">
      <EnTetePage eyebrow={t("Gouvernance")} titre={t("Journal d'audit")} sousTitre={t("Toutes les actions administratives : réglages, boutiques, plans, retraits, équipe, rapports envoyés.")} />
      <Note>{t("Données réelles uniquement, quel que soit le filtre de source. Le journal est en lecture seule.")}</Note>

      <form method="get" className="flex flex-wrap items-end gap-2 cc-no-print" aria-label={t("Filtrer le journal")}>
        <label className="grid gap-1 text-[12px] cc-muted">{t("Action")}
          <select name="action" defaultValue={action ?? ""} className="cc-select min-w-[200px]">
            <option value="">{t("Toutes")}</option>
            {action && !actions.some((a) => a.action === action) && <option value={action}>{action}…</option>}
            {actions.map((a) => <option key={a.action} value={a.action}>{a.action}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-[12px] cc-muted">Admin
          <select name="admin" defaultValue={admin ?? ""} className="cc-select min-w-[200px]">
            <option value="">{t("Tous")}</option>
            {admins.map((a) => <option key={a.adminEmail} value={a.adminEmail}>{a.adminEmail}</option>)}
          </select>
        </label>
        <button className="cc-btn cc-btn-sm">{t("Filtrer")}</button>
        {(action || admin) && <Link href="/admin/audit" className="cc-btn cc-btn-ghost cc-btn-sm">{t("Réinitialiser")}</Link>}
        <span className="cc-faint text-[12px] ml-auto">{t(total > 1 ? "{0} entrées" : "{0} entrée", total.toLocaleString(t.loc))}</span>
      </form>

      <Carte pad={false}>
        {!lignes.length ? <EtatVide titre={t("Aucune entrée")} explication={t(action || admin ? "Aucune action ne correspond à ces filtres." : "Les actions des administrateurs (réglages, boutiques, retraits, équipe…) apparaîtront ici.")} /> : (
          <div className="overflow-x-auto">
            <table className="cc-table">
              <thead><tr><th>{t("Date")}</th><th>Admin</th><th>{t("Action")}</th><th>{t("Entité")}</th><th>ID</th><th>IP</th><th>{t("Avant / après")}</th></tr></thead>
              <tbody>
                {lignes.map((l) => (
                  <tr key={l.id} className="align-top">
                    <td className="whitespace-nowrap cc-num">{l.createdAt.toLocaleString(t.loc, { dateStyle: "short", timeStyle: "medium", timeZone: "UTC" })} <span className="cc-faint">UTC</span></td>
                    <td className="max-w-[200px] truncate" title={l.adminEmail}>{l.adminEmail}</td>
                    <td><code className="text-[12px]">{l.action}</code></td>
                    <td>{l.entite}</td>
                    <td className="max-w-[160px] truncate cc-faint" title={l.entiteId ?? ""}>{l.entiteId ?? "—"}</td>
                    <td className="cc-faint whitespace-nowrap">{l.ip ?? "—"}</td>
                    <td className="min-w-[160px]">
                      {l.avant == null && l.apres == null ? <span className="cc-faint">—</span> : (
                        <details>
                          <summary className="cursor-pointer text-[12px]" style={{ color: "var(--cc-accent-text)" }}>{t("Voir")}</summary>
                          <div className="grid gap-2 mt-2 lg:grid-cols-2">
                            <div><p className="cc-eyebrow mb-1">{t("Avant")}</p><pre className="text-[11px] whitespace-pre-wrap break-all p-2 rounded max-h-64 overflow-auto" style={{ background: "var(--cc-surface-2)" }}>{json(l.avant)}</pre></div>
                            <div><p className="cc-eyebrow mb-1">{t("Après")}</p><pre className="text-[11px] whitespace-pre-wrap break-all p-2 rounded max-h-64 overflow-auto" style={{ background: "var(--cc-surface-2)" }}>{json(l.apres)}</pre></div>
                          </div>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Carte>
      {pages > 1 && (
        <nav className="flex items-center justify-end gap-2 text-[12px]" aria-label="Pagination">
          {page > 1 ? <Link href={href(page - 1)} className="cc-btn cc-btn-sm">{t("Précédent")}</Link> : <span className="cc-btn cc-btn-sm opacity-50" aria-disabled>{t("Précédent")}</span>}
          <span className="cc-faint">{t("Page {0} / {1}", page, pages)}</span>
          {page < pages ? <Link href={href(page + 1)} className="cc-btn cc-btn-sm">{t("Suivant")}</Link> : <span className="cc-btn cc-btn-sm opacity-50" aria-disabled>{t("Suivant")}</span>}
        </nav>
      )}
    </div>
  );
}
