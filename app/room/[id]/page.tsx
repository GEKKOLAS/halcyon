import type { Metadata } from "next";
import { Suspense } from "react";
import { RoomClient } from "@/components/room-client";

export const metadata: Metadata = {
  title: "Halcyon — In a call",
  robots: { index: false, follow: false },
};

export default function RoomPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div className="h-[100dvh] bg-background" />}>
      <RoomClient roomId={params.id} />
    </Suspense>
  );
}
