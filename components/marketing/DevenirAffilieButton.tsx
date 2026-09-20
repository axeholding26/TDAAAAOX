"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { enregistrerAffiliationLocale, lireProfilAffilieLocal, type ProfilAffilie } from "@/lib/affiliation-local";

interface Props {
  programmeId: string;
  nomBoutique: string;
  logoUrl: string | null;
  nomProgramme: string;
}

// Bouton "Devenir affilié" d'une carte produit du marketplace. Si le
// visiteur a déjà un profil affilié local (créé via le panneau du hero ou
// une précédente candidature), le rejoint instantanément sans repasser par
// le formulaire — sinon, comportement inchangé : renvoie vers /rejoindre.
export function DevenirAffilieButton({ programmeId, nomBoutique, logoUrl, nomProgramme }: Props) {
  const [profil, setProfil] = useState<ProfilAffilie | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setProfil(lireProfilAffilieLocal()); }, []);

  async function rejoindreInstantanement() {
    if (!profil) return;
    setLoading(true);
    try {
      const res = await fetch("/api/affiliation/rejoindre", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programmeId, ...profil }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      enregistrerAffiliationLocale({ portalToken: data.affilie.portalToken, nomBoutique, logoUrl, nomProgramme });
      window.location.href = `/affilie/${data.affilie.portalToken}`;
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de l'inscription");
      setLoading(false);
    }
  }

  if (!profil) {
    return (
      <Link href={`/rejoindre/${programmeId}`}
        className="block text-center py-2 rounded-xl text-xs font-bold transition-all hover:opacity-90"
        style={{ background: "#F5A623", color: "#080808" }}>
        Devenir affilié
      </Link>
    );
  }

  return (
    <button onClick={rejoindreInstantanement} disabled={loading}
      className="w-full text-center py-2 rounded-xl text-xs font-bold transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-1.5"
      style={{ background: "#F5A623", color: "#080808" }}>
      {loading ? <Loader2 size={12} className="animate-spin" /> : "Rejoindre en 1 clic"}
    </button>
  );
}
