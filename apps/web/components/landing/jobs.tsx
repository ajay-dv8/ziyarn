"use client";

import TiltedCard from "@/components/TiltedCard";

type AgentJob = {
  title: string;
  points: string[];
};

const JOBS: AgentJob[] = [
  {
    title: "The helpdesk job",
    points: [
      "Answers customer questions from your docs, site, and data — at 2 a.m. included",
      "Says so and escalates when something isn't in its knowledge — never invents",
      "Hands the conversation to your team in realtime; replies stream back to the visitor",
    ],
  },
  {
    title: "The sales job",
    points: [
      "Qualifies visitors with your questions and captures their email as a lead",
      "Books appointments while intent is hot, confirmed inside the chat",
      "Sells your catalog through secure checkout links the visitor pays on",
    ],
  },
];

/**
 * One flip card per agent job. Front: title + a "Details" chip; clicking
 * anywhere on the card rotates it (TiltedCard's flip) to reveal the list.
 * The card itself is the button — the chip is decorative, so the front never
 * nests a real button inside it.
 */
function JobCard({ job }: { job: AgentJob }) {
  return (
    <TiltedCard
      containerHeight={400}
      containerWidth="100%"
      imageWidth="100%"
      imageHeight={400}
      showTooltip={false}
      scaleOnHover={1.02}
      rotateAmplitude={8}
      radius={20}
      backContent={
        <div className="flex h-full flex-col justify-center gap-5 bg-slate-900 px-6 md:px-8">
          {job.points.map((point) => (
            <div key={point} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-3 size-1.5 shrink-0 rounded-full bg-cyan-400"
              />
              <p className="text-base leading-relaxed text-zinc-300 md:text-lg">{point}</p>
            </div>
          ))}
        </div>
      }
    >
      <div className="flex h-full flex-col items-center justify-center gap-8 bg-slate-900 px-8 text-center">
        <h3 className="text-3xl font-semibold tracking-wide text-white md:text-4xl">
          {job.title}
        </h3>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-2.5 text-sm font-medium text-zinc-300">
          Details
        </span>
      </div>
    </TiltedCard>
  );
}

export function Jobs() {
  return (
    <section className="w-full py-16 md:px-40 md:py-24">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        {JOBS.map((job) => (
          <JobCard key={job.title} job={job} />
        ))}
      </div>
    </section>
  );
}
