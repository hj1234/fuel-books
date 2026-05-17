import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AircraftDetailPage({ params }: { params: Promise<{ aircraftId: string }> }) {
  const { aircraftId } = await params;
  redirect(`/aircraft/${aircraftId}/expenses`);
}

