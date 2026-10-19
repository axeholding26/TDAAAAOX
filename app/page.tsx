import { NavbarMarketing } from "@/components/marketing/NavbarMarketing";
import { HeroSection } from "@/components/marketing/HeroSection";
import { PartenairesSection } from "@/components/marketing/PartenairesSection";
import { ConstructeurSection } from "@/components/marketing/ConstructeurSection";
import { AxiaSection } from "@/components/marketing/AxiaSection";
import { VideoSection } from "@/components/marketing/VideoSection";
import { TarifsSection } from "@/components/marketing/TarifsSection";
import { TemoignagesSection } from "@/components/marketing/TemoignagesSection";
import { FaqSection } from "@/components/marketing/FaqSection";
import { CtaFinal } from "@/components/marketing/CtaFinal";
import { FooterMarketing } from "@/components/marketing/FooterMarketing";
import { PauseHorsEcran } from "@/components/marketing/PauseHorsEcran";
import { Preloader } from "@/components/marketing/Preloader";
import { avisPublies } from "@/lib/avis-plateforme";

export default async function HomePage() {
  const avis = await avisPublies(8);
  return (
    <main className="overflow-x-clip bg-white text-gray-900">
      {/* Logo de la marque pour Google (panneau de connaissances, résultats) : https://developers.google.com/search/docs/appearance/structured-data/logo */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Axso",
            url: "https://axsoafrica.com",
            logo: "https://axsoafrica.com/icon.png",
          }),
        }}
      />
      {/* overflow-x-clip, pas -hidden : « hidden » fait de <main> une seconde zone de défilement
          (overflow-y passe à auto) ; sur mobile, le doigt hésitait entre la page et <main> en bas de page. */}
      <Preloader/>
      <NavbarMarketing/>
      <HeroSection/>
      <PartenairesSection/>
      <ConstructeurSection/>
      <AxiaSection/>
      <VideoSection/>
      <TarifsSection/>
      <TemoignagesSection reels={avis}/>
      <FaqSection/>
      <CtaFinal/>
      <FooterMarketing/>
      <PauseHorsEcran/>
    </main>
  );
}
