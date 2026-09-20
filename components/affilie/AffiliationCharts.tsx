"use client";

import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Jour { date: string; clics: number; conversions: number; commissions: number; }

function TooltipClics({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid #EBEBEB", borderRadius: 14, padding: "10px 14px", boxShadow: "0 12px 40px rgba(0,0,0,0.12)", fontFamily: "'Poppins',system-ui,sans-serif" }}>
      <p style={{ fontSize: 10.5, color: "#AAA", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</p>
      <p style={{ fontSize: 12, color: "#3b82f6", fontWeight: 700 }}>{payload[0]?.value ?? 0} clic{payload[0]?.value > 1 ? "s" : ""}</p>
      <p style={{ fontSize: 12, color: "#10b981", fontWeight: 700 }}>{payload[1]?.value ?? 0} conversion{payload[1]?.value > 1 ? "s" : ""}</p>
    </div>
  );
}

function TooltipCommissions({ active, payload, label, devise }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid #EBEBEB", borderRadius: 14, padding: "10px 14px", boxShadow: "0 12px 40px rgba(0,0,0,0.12)", fontFamily: "'Poppins',system-ui,sans-serif" }}>
      <p style={{ fontSize: 10.5, color: "#AAA", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</p>
      <p style={{ fontSize: 13, color: "#F5A623", fontWeight: 800 }}>{(payload[0]?.value ?? 0).toLocaleString("fr-FR")} {devise}</p>
    </div>
  );
}

export function ClicsConversionsChart({ donnees }: { donnees: Jour[] }) {
  const totalClics = donnees.reduce((s, d) => s + d.clics, 0);
  const totalConv = donnees.reduce((s, d) => s + d.conversions, 0);
  return (
    <div style={{ background: "white", borderRadius: 20, padding: 20, boxShadow: "0 4px 16px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <p style={{ fontSize: 12.5, fontWeight: 700, color: "#111" }}>Clics et conversions par jour</p>
      </div>
      {totalClics === 0 && totalConv === 0 ? (
        <p style={{ fontSize: 12, color: "#BBB", textAlign: "center", padding: "32px 0" }}>Aucune activité sur cette période.</p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={donnees} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="#F3F3F3" vertical={false} />
            <XAxis dataKey="date" stroke="transparent" tick={{ fill: "#C8C8C8", fontSize: 10, fontFamily: "'Poppins',sans-serif" }} tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(donnees.length / 8) - 1)} />
            <YAxis stroke="transparent" tick={{ fill: "#C8C8C8", fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip content={<TooltipClics />} cursor={{ stroke: "#F5A623", strokeWidth: 1, strokeDasharray: "4 3", strokeOpacity: 0.5 }} />
            <Line type="monotone" dataKey="clics" stroke="#3b82f6" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }} />
            <Line type="monotone" dataKey="conversions" stroke="#10b981" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 12, paddingTop: 12, borderTop: "1px solid #F5F5F7" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 10, height: 3, borderRadius: 2, background: "#3b82f6" }} />
          <span style={{ fontSize: 11, color: "#999" }}>Clics ({totalClics})</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 10, height: 3, borderRadius: 2, background: "#10b981" }} />
          <span style={{ fontSize: 11, color: "#999" }}>Conversions ({totalConv})</span>
        </div>
      </div>
    </div>
  );
}

export function CommissionsChart({ donnees, devise }: { donnees: Jour[]; devise: string }) {
  const total = donnees.reduce((s, d) => s + d.commissions, 0);
  return (
    <div style={{ background: "white", borderRadius: 20, padding: 20, boxShadow: "0 4px 16px rgba(0,0,0,0.04)" }}>
      <p style={{ fontSize: 12.5, fontWeight: 700, color: "#111", marginBottom: 16 }}>Commissions par jour ({devise})</p>
      {total === 0 ? (
        <p style={{ fontSize: 12, color: "#BBB", textAlign: "center", padding: "32px 0" }}>Aucune commission sur cette période.</p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={donnees} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="#F3F3F3" vertical={false} />
            <XAxis dataKey="date" stroke="transparent" tick={{ fill: "#C8C8C8", fontSize: 10, fontFamily: "'Poppins',sans-serif" }} tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(donnees.length / 8) - 1)} />
            <YAxis stroke="transparent" tick={{ fill: "#C8C8C8", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
            <Tooltip content={<TooltipCommissions devise={devise} />} cursor={{ fill: "#F5A62310" }} />
            <Bar dataKey="commissions" fill="#F5A623" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
