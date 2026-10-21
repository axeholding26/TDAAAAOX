import { SupportMarchand } from "./SupportMarchand";

// « Signaler un problème » : formulaire + suivi des signalements de la boutique.
export default async function SupportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { depuis } = await searchParams;
  return <SupportMarchand depuis={typeof depuis === "string" ? depuis : ""} />;
}
