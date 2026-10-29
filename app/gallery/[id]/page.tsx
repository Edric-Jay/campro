import { Suspense } from "react";
import { ReviewView } from "@/components/gallery/review-view";

async function ReviewLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReviewView id={id} />;
}

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-ink" />}>
      <ReviewLoader params={params} />
    </Suspense>
  );
}
