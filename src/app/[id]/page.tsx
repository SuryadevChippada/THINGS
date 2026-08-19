import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { things, getThing } from "@/things/registry";
import { BackLink } from "@/components/navigation/BackLink";
import { ThingShell } from "@/components/shared/ThingShell";
import { ThingStage } from "@/components/shared/ThingStage";
import { hints } from "@/things/hints";

export function generateStaticParams() {
  return things.map((t) => ({ id: t.id }));
}

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const thing = getThing(id);
  return { title: thing ? `${thing.id} — ${thing.title}` : "THINGS" };
}

export default async function ThingPage({ params }: Params) {
  const { id } = await params;
  const thing = getThing(id);
  if (!thing) notFound();

  if (thing.status !== "complete") {
    return (
      <>
        <BackLink />
        <main className="unbuilt">
          <span className="unbuilt__num">{thing.id}</span>
          <h1 className="unbuilt__title">{thing.title}</h1>
          <span className="unbuilt__note">not made yet</span>
        </main>
      </>
    );
  }

  return (
    <>
      <BackLink />
      <ThingShell title={thing.title} hint={hints[thing.id]}>
        <ThingStage id={thing.id} />
      </ThingShell>
    </>
  );
}
