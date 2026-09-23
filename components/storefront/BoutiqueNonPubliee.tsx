import Link from "next/link";
import { Rocket } from "lucide-react";

// Affiché à l'équipe d'une boutique pas encore publiée qui ouvre sa vitrine
// (« Ma boutique », « Voir la boutique »…) : la boutique ne se visualise
// qu'une fois publiée. Le public, lui, reçoit un 404.
export function BoutiqueNonPubliee({ nomBoutique }: { nomBoutique: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F7F7F8] px-4" style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#EBEBEB] shadow-[0_8px_30px_rgba(0,0,0,0.06)] p-8 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-[#FFF1D6] flex items-center justify-center mb-5">
          <Rocket size={26} className="text-[#C77C0A]" />
        </div>
        <h1 className="text-[20px] font-semibold text-[#111111]">{nomBoutique} n'est pas encore publiée</h1>
        <p className="mt-2.5 text-[15px] leading-relaxed text-[#666666]">
          Publie ta boutique pour la visualiser en ligne. Tu pourras ensuite la voir exactement comme tes clients.
        </p>
        <div className="mt-7 flex flex-col gap-2.5">
          <Link href="/dashboard/builder" className="h-11 flex items-center justify-center rounded-xl bg-[#F5A623] text-[15px] font-semibold text-[#111111] hover:bg-[#E8990F] transition-colors">
            Publier depuis le Constructeur
          </Link>
          <Link href="/dashboard" className="h-11 flex items-center justify-center rounded-xl text-[15px] font-medium text-[#555555] hover:bg-[#F5F5F5] transition-colors">
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    </main>
  );
}
