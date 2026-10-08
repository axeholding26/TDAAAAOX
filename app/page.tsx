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

export default function HomePage() {
  return (
    <main className="overflow-x-clip bg-white text-gray-900">
      {/* overflow-x-clip, pas -hidden : « hidden » fait de <main> une seconde zone de défilement
          (overflow-y passe à auto) ; sur mobile, le doigt hésitait entre la page et <main> en bas de page. */}
      <NavbarMarketing/>
      <HeroSection/>
      <PartenairesSection/>
      <ConstructeurSection/>
      <AxiaSection/>
      <VideoSection/>
      <TarifsSection/>
      <TemoignagesSection/>
      <FaqSection/>
      <CtaFinal/>
      <FooterMarketing/>
      <PauseHorsEcran/>
    </main>
  );
}
