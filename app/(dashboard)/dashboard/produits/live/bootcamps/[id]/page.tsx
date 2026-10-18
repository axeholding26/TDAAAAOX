import { ConsoleBootcamp } from "@/components/live/LiveDashboard";

export default async function ConsoleBootcampPage({ params }: { params: Promise<{ id: string }> }) {
  return <ConsoleBootcamp id={(await params).id} />;
}
