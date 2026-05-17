import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { isCanonicalUuidString } from "@/lib/isUuid";

type Props = {
  children: ReactNode;
  params: Promise<{ aircraftId: string }>;
};

export default async function AircraftScopeLayout({ children, params }: Props) {
  const { aircraftId } = await params;
  if (!isCanonicalUuidString(aircraftId)) {
    notFound();
  }
  return children;
}
