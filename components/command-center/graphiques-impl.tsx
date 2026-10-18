"use client";
// Graphiques Recharts du Command Center — chargés à la demande (voir graphiques.tsx).
// Règles : un seul axe Y, couleurs de série dans l'ordre fixe (--cc-s1…), grille discrète,
// infobulle au survol, légende dès 2 séries.
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, LineChart, Line, ComposedChart } from "recharts";
import type { Format } from "@/lib/command-center/moteur";
import { formats } from "@/lib/command-center/format";
import { useT } from "@/components/I18nProvider";

/** Formatage dans la langue de l'interface. */
const useFormat = () => formats(useT()).formatValeur;

export type Point = { x: string } & Record<string, number | string | null>;
export type Serie = { cle: string; nom: string; couleur?: string; pointille?: boolean };

const COULEURS = ["var(--cc-s1)", "var(--cc-s2)", "var(--cc-s3)", "var(--cc-s4)", "var(--cc-s5)"];
const axe = { stroke: "var(--cc-text-3)", fontSize: 11, tickLine: false, axisLine: false } as const;

function Bulle({ active, payload, label, format }: { active?: boolean; payload?: any[]; label?: string; format: Format }) {
  const formatValeur = useFormat();
  if (!active || !payload?.length) return null;
  return (
    <div className="cc-card px-3 py-2 text-[12px]" style={{ boxShadow: "var(--cc-shadow)" }}>
      <p className="cc-faint mb-1">{label}</p>
      {payload.filter((p) => p.value != null).map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} aria-hidden />
          <span className="cc-muted">{p.name}</span>
          <span className="font-semibold cc-num ml-auto pl-3">{formatValeur(p.value, format)}</span>
        </p>
      ))}
    </div>
  );
}

export function Courbes({ donnees, series, format, hauteur = 240, aire = true, empile = false }: { donnees: Point[]; series: Serie[]; format: Format; hauteur?: number; aire?: boolean; empile?: boolean }) {
  const formatValeur = useFormat();
  const Graph = aire ? AreaChart : LineChart;
  return (
    <ResponsiveContainer width="100%" height={hauteur}>
      <Graph data={donnees} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--cc-grid)" />
        <XAxis dataKey="x" {...axe} minTickGap={24} />
        <YAxis {...axe} width={56} tickFormatter={(v) => formatValeur(v, format).replace(" FCFA", "")} />
        <Tooltip content={<Bulle format={format} />} cursor={{ stroke: "var(--cc-border-strong)" }} />
        {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "var(--cc-text-2)" }} />}
        {series.map((s, i) => aire
          ? <Area key={s.cle} type="monotone" dataKey={s.cle} name={s.nom} stackId={empile ? "a" : undefined} stroke={s.couleur ?? COULEURS[i]} fill={s.couleur ?? COULEURS[i]} fillOpacity={series.length > 1 && !empile ? 0.05 : 0.12} strokeWidth={2} strokeDasharray={s.pointille ? "4 4" : undefined} dot={false} activeDot={{ r: 4 }} connectNulls />
          : <Line key={s.cle} type="monotone" dataKey={s.cle} name={s.nom} stroke={s.couleur ?? COULEURS[i]} strokeWidth={2} strokeDasharray={s.pointille ? "4 4" : undefined} dot={false} activeDot={{ r: 4 }} connectNulls />)}
      </Graph>
    </ResponsiveContainer>
  );
}

export function Barres({ donnees, series, format, hauteur = 240, empile = false, horizontal = false }: { donnees: Point[]; series: Serie[]; format: Format; hauteur?: number; empile?: boolean; horizontal?: boolean }) {
  const formatValeur = useFormat();
  return (
    <ResponsiveContainer width="100%" height={hauteur}>
      <BarChart data={donnees} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
        <CartesianGrid vertical={horizontal} horizontal={!horizontal} stroke="var(--cc-grid)" />
        {horizontal ? <><XAxis type="number" {...axe} tickFormatter={(v) => formatValeur(v, format).replace(" FCFA", "")} /><YAxis type="category" dataKey="x" {...axe} width={110} /></>
          : <><XAxis dataKey="x" {...axe} minTickGap={12} /><YAxis {...axe} width={56} tickFormatter={(v) => formatValeur(v, format).replace(" FCFA", "")} /></>}
        <Tooltip content={<Bulle format={format} />} cursor={{ fill: "var(--cc-surface-2)" }} />
        {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "var(--cc-text-2)" }} />}
        {series.map((s, i) => <Bar key={s.cle} dataKey={s.cle} name={s.nom} stackId={empile ? "a" : undefined} fill={s.couleur ?? COULEURS[i]} radius={empile && i < series.length - 1 ? 0 : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={36} stroke="var(--cc-surface)" strokeWidth={empile ? 1 : 0} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Waterfall MRR : début → + nouveau → + expansion → − contraction → − churn → fin. */
export function Cascade({ etapes, format, hauteur = 240 }: { etapes: { nom: string; valeur: number; type: "total" | "plus" | "moins" }[]; format: Format; hauteur?: number }) {
  const formatValeur = useFormat();
  let cumul = 0;
  const donnees = etapes.map((e) => {
    if (e.type === "total") { cumul = e.valeur; return { x: e.nom, base: 0, valeur: e.valeur, type: e.type }; }
    const base = e.type === "plus" ? cumul : cumul - e.valeur;
    cumul = e.type === "plus" ? cumul + e.valeur : cumul - e.valeur;
    return { x: e.nom, base, valeur: e.valeur, type: e.type };
  });
  const couleur = (t: string) => (t === "plus" ? "var(--cc-good)" : t === "moins" ? "var(--cc-bad)" : "var(--cc-s1)");
  return (
    <ResponsiveContainer width="100%" height={hauteur}>
      <BarChart data={donnees} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--cc-grid)" />
        <XAxis dataKey="x" {...axe} interval={0} />
        <YAxis {...axe} width={56} tickFormatter={(v) => formatValeur(v, format).replace(" FCFA", "")} />
        <Tooltip cursor={{ fill: "var(--cc-surface-2)" }} content={({ active, payload, label }) => active && payload?.length ? (
          <div className="cc-card px-3 py-2 text-[12px]"><p className="cc-faint">{label}</p><p className="font-semibold cc-num">{(payload[0].payload.type === "moins" ? "−" : payload[0].payload.type === "plus" ? "+" : "") + formatValeur(payload[0].payload.valeur, format)}</p></div>
        ) : null} />
        <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
        <Bar dataKey="valeur" stackId="w" radius={[4, 4, 0, 0]} maxBarSize={56}>
          {donnees.map((d) => <Cell key={d.x} fill={couleur(d.type)} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Historique + projection (3 scénarios), la projection en pointillés et clairement libellée. */
export function Projection({ donnees, format, hauteur = 220 }: { donnees: Point[]; format: Format; hauteur?: number }) {
  const t = useT();
  const formatValeur = formats(t).formatValeur;
  return (
    <ResponsiveContainer width="100%" height={hauteur}>
      <ComposedChart data={donnees} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--cc-grid)" />
        <XAxis dataKey="x" {...axe} minTickGap={20} />
        <YAxis {...axe} width={56} tickFormatter={(v) => formatValeur(v, format).replace(" FCFA", "")} />
        <Tooltip content={<Bulle format={format} />} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "var(--cc-text-2)" }} />
        <Area type="monotone" dataKey="historique" name={t("Réalisé")} stroke="var(--cc-s1)" fill="var(--cc-s1)" fillOpacity={0.1} strokeWidth={2} dot={false} connectNulls />
        <Line type="monotone" dataKey="ambitieux" name={t("Projection ambitieuse")} stroke="var(--cc-s3)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} connectNulls />
        <Line type="monotone" dataKey="attendu" name={t("Projection attendue")} stroke="var(--cc-s1)" strokeDasharray="5 4" strokeWidth={2} dot={false} connectNulls />
        <Line type="monotone" dataKey="prudent" name={t("Projection prudente")} stroke="var(--cc-s2)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
