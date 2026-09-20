import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { Star, MessageSquare, CheckCircle2, Clock, ShieldCheck } from "lucide-react";
import { BoutonRevoirTutoriel } from "@/components/dashboard/ModuleTutorial";
import { AvisTutorial } from "@/components/dashboard/tutorials/AvisTutorial";

const AVATAR_COLORS = [
  ["#FFF8EC","#F5A623"],["#EFF6FF","#3B82F6"],["#F0FDF4","#16A34A"],
  ["#FAF5FF","#7C3AED"],["#FFF1F2","#E11D48"],["#ECFEFF","#0891B2"],
];

function Avatar({ nom }: { nom: string }) {
  const hash = nom.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const [bg, text] = AVATAR_COLORS[hash % AVATAR_COLORS.length];
  const initiales = nom.trim().split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[11px] font-bold flex-shrink-0"
      style={{ background: bg, color: text, border: `1px solid ${text}20` }}>
      {initiales}
    </div>
  );
}

function Stars({ note, size = 13 }: { note: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={size}
          fill={i <= note ? "#F5A623" : "transparent"}
          stroke={i <= note ? "#F5A623" : "#E8E8E8"} />
      ))}
    </div>
  );
}

export default async function AvisPage() {
  const session = await auth();
  if (!session) redirect("/connexion");

  const tenantId = (session.user as any)?.tenantId;
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) redirect("/inscription");

  const avis = await prisma.avis.findMany({
    where: { tenantId },
    include: {
      produit: { select: { nom: true } },
      client:  { select: { nom: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const noteMoyenne  = avis.length > 0 ? avis.reduce((s, a) => s + a.note, 0) / avis.length : 0;
  const nonApprouves = avis.filter(a => !a.approuve).length;
  const repartition  = [5,4,3,2,1].map(note => ({ note, count: avis.filter(a => a.note === note).length }));

  const NOTE_COLORS: Record<number, string> = { 5:"#16A34A", 4:"#F5A623", 3:"#D97706", 2:"#EA580C", 1:"#DC2626" };

  return (
    <div className="space-y-5"
      style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <AvisTutorial />

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap pt-1">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="text-[20px] font-bold text-[#111111] tracking-tight">Avis clients</h1>
            <BoutonRevoirTutoriel moduleKey="avis" />
            <span className="text-[11px] font-bold bg-[#F5F5F7] text-[#888888] border border-[#E8E8E8] px-2.5 py-0.5 rounded-full">
              {avis.length}
            </span>
          </div>
          <p className="text-[12.5px] text-[#AAAAAA]">
            {avis.length} avis au total · {nonApprouves} en attente de modération
          </p>
        </div>
        {nonApprouves > 0 && (
          <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[#B45309] bg-[#FFFBEB] border border-[#FDE68A] px-3 py-1.5 rounded-2xl">
            <Clock size={13} /> {nonApprouves} à modérer
          </span>
        )}
      </div>

      {/* ── Stats : note + répartition ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Note moyenne */}
        <div className="ax-card p-8 flex flex-col items-center justify-center text-center">
          <span className="ax-label mb-3">Note moyenne</span>
          <p className="text-[52px] font-black text-[#111111] leading-none tabular-nums">
            {noteMoyenne > 0 ? noteMoyenne.toFixed(1) : "—"}
          </p>
          <div className="my-3">
            <Stars note={Math.round(noteMoyenne)} size={20} />
          </div>
          <p className="text-[12px] text-[#AAAAAA]">
            Basé sur <span className="font-semibold text-[#666]">{avis.length}</span> avis
          </p>
          {avis.length > 0 && (
            <div className="mt-4 flex items-center gap-4 pt-4 border-t border-[#F5F5F5] w-full justify-center">
              <div className="flex items-center gap-1 text-[11.5px] text-[#16A34A]">
                <CheckCircle2 size={11} /> {avis.filter(a => a.approuve).length} approuvés
              </div>
              <div className="flex items-center gap-1 text-[11.5px] text-[#D97706]">
                <Clock size={11} /> {nonApprouves} en attente
              </div>
            </div>
          )}
        </div>

        {/* Répartition */}
        <div className="lg:col-span-2 ax-card p-6">
          <h3 className="text-[13px] font-semibold text-[#111111] mb-4">Répartition des notes</h3>
          {avis.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-[12px] text-[#AAAAAA]">
              Aucune donnée disponible
            </div>
          ) : (
            <div className="space-y-3">
              {repartition.map(({ note, count }) => {
                const pct = avis.length > 0 ? (count / avis.length) * 100 : 0;
                return (
                  <div key={note} className="flex items-center gap-3">
                    <div className="flex items-center gap-1 w-12 flex-shrink-0">
                      <span className="text-[13px] font-bold text-[#333]">{note}</span>
                      <Star size={11} fill="#F5A623" stroke="none" />
                    </div>
                    <div className="flex-1 bg-[#F5F5F7] rounded-full h-2 overflow-hidden">
                      <div className="h-2 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: NOTE_COLORS[note] }} />
                    </div>
                    <div className="w-16 text-right flex-shrink-0">
                      <span className="text-[13px] font-bold text-[#333]">{count}</span>
                      <span className="text-[11px] text-[#CCCCCC] ml-1">({Math.round(pct)}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Bannière modération ── */}
      {nonApprouves > 0 && (
        <div className="ax-card-flat flex items-center gap-3 p-4 border-[#FDE68A]/60"
          style={{ background: "#FFFBEB" }}>
          <Clock size={15} className="text-[#F5A623] flex-shrink-0" />
          <p className="text-[12.5px] text-[#92400E]">
            <strong>{nonApprouves} avis</strong> en attente de modération — approuvez-les pour qu'ils soient visibles sur votre boutique.
          </p>
        </div>
      )}

      {/* ── Liste ── */}
      <div className="ax-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[#F3F3F3] flex items-center gap-2">
          <MessageSquare size={15} className="text-[#AAAAAA]" />
          <h2 className="text-[13px] font-semibold text-[#111111]">Tous les avis</h2>
          {avis.length > 0 && (
            <span className="ml-auto text-[11px] font-bold text-[#888] bg-[#F5F5F7] border border-[#EBEBEB] px-2 py-0.5 rounded-full">
              {avis.length}
            </span>
          )}
        </div>

        {avis.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-4 text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-[#FFF8EC] flex items-center justify-center">
              <Star size={24} className="text-[#F5A623]" fill="#F5A623" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-[#111111]">Aucun avis client</p>
              <p className="text-[12px] text-[#AAAAAA] mt-1">
                Les avis apparaîtront ici dès que vos clients auront évalué leurs achats.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-[#F9F9F9]">
            {avis.map(a => (
              <div key={a.id} className="p-5 hover:bg-[#FAFAFA] transition-colors">
                <div className="flex items-start gap-3">
                  <Avatar nom={a.client.nom} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2 mb-1.5">
                      <span className="text-[13px] font-semibold text-[#222]">{a.client.nom}</span>
                      {a.verifie && (
                        <span className="flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]">
                          <ShieldCheck size={9} /> Achat vérifié
                        </span>
                      )}
                      <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full border ${
                        a.approuve
                          ? "bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]"
                          : "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]"
                      }`}>
                        {a.approuve ? "Approuvé" : "En attente"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <Stars note={a.note} />
                      <span className="text-[11px] text-[#AAAAAA]">{a.note}/5</span>
                    </div>
                    {a.titre && (
                      <p className="text-[13px] font-semibold text-[#333] mb-1">{a.titre}</p>
                    )}
                    {a.commentaire && (
                      <p className="text-[12.5px] text-[#666666] leading-relaxed">{a.commentaire}</p>
                    )}
                    <p className="text-[11px] text-[#CCCCCC] mt-2">
                      {a.produit?.nom && (
                        <><span className="text-[#AAAAAA]">{a.produit.nom}</span> · </>
                      )}
                      {formatDate(a.createdAt)}
                    </p>
                  </div>
                  {!a.approuve && (
                    <div className="flex-shrink-0">
                      <form
                        action={async () => {
                          "use server";
                          await prisma.avis.update({ where: { id: a.id }, data: { approuve: true } });
                        }}
                      >
                        <button type="submit"
                          className="text-[11.5px] font-semibold border px-3 py-1.5 rounded-2xl transition-all hover:scale-[1.01] bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0] hover:bg-[#ECFDF5]">
                          Approuver
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
