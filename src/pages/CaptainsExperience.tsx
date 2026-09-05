import { Loader2 } from "lucide-react";
import { useParams } from "react-router-dom";
import { useCaptainsEventDetail } from "@/hooks/useCaptains";
import CaptainsDemoV2 from "./CaptainsDemoV2";
import CaptainsPublic from "./CaptainsPublic";

export default function CaptainsExperience() {
  const { eventSlug } = useParams();
  const eventQuery = useCaptainsEventDetail(eventSlug);

  if (eventQuery.isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fff9f6] text-[#2f292d]" role="status">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#f06a5f]" />
          <p className="text-sm font-medium">Preparando vuestra partida…</p>
        </div>
      </main>
    );
  }

  if (eventQuery.data?.event.experience_version === "v2") {
    return <CaptainsDemoV2 eventSlug={eventSlug} />;
  }

  return <CaptainsPublic />;
}
