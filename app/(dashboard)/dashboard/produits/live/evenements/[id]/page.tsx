import { ConsoleEvenement } from "@/components/live/LiveDashboard";

export default async function ConsoleEvenementPage({ params }: { params: Promise<{ id: string }> }) {
  return <ConsoleEvenement id={(await params).id} />;
}
