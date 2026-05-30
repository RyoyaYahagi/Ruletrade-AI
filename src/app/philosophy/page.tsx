import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Product Philosophy | Ruletrade-AI",
  description:
    "Why we believe defining and recording investment rules matters.",
};

export default function PhilosophyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-heading text-2xl font-semibold tracking-tight mb-8">
        Product Philosophy
      </h1>

      <section className="space-y-6 text-muted-foreground leading-relaxed">
        <p>
          Ruletrade-AI helps you define, review, record, and improve your
          investment rules <em>before</em> you invest—not after.
        </p>

        <h2 className="font-heading text-lg font-medium text-foreground mt-8">
          The Problem
        </h2>
        <p>
          Many individual investors make decisions based on emotion, news, or
          hunches. When results are poor, it is hard to remember why you bought
          or sold. When results are good, it is hard to know if it was skill or
          luck. Without a clear process, the same mistakes repeat.
        </p>

        <h2 className="font-heading text-lg font-medium text-foreground mt-8">
          Our Approach
        </h2>
        <p>
          Ruletrade-AI does not tell you what to buy or sell. Instead, it helps
          you:
        </p>
        <ol className="list-decimal list-inside space-y-2 ml-4">
          <li>
            <strong className="text-foreground">Define</strong> your own rules
            based on your situation, risk tolerance, and goals
          </li>
          <li>
            <strong className="text-foreground">Review</strong> those rules for
            contradictions, missing elements, and unsafe assumptions
          </li>
          <li>
            <strong className="text-foreground">Record</strong> your decisions
            so you can learn from outcomes
          </li>
          <li>
            <strong className="text-foreground">Improve</strong> your rules over
            time based on evidence and reflection
          </li>
        </ol>

        <h2 className="font-heading text-lg font-medium text-foreground mt-8">
          What AI Does (and Doesn&apos;t Do)
        </h2>
        <p>
          AI <strong className="text-foreground">assists</strong> with drafting,
          reviewing, explaining, and evaluating rules. AI{" "}
          <strong className="text-foreground">does not</strong> make final
          decisions, guarantee returns, or give personalized financial advice.
          You <strong className="text-foreground">approve</strong> every rule
          before it becomes active. You can modify, reject, or discard any AI
          suggestion.
        </p>

        <h2 className="font-heading text-lg font-medium text-foreground mt-8">
          Long-Term Thinking
        </h2>
        <p>
          Asset building is a long-term endeavor. Short-term price movements and
          news headlines can derail even sound strategies. By writing down your
          rules in advance, you create an anchor that helps you stay consistent
          through market volatility.
        </p>

        <h2 className="font-heading text-lg font-medium text-foreground mt-8">
          Not Investment Advice
        </h2>
        <p>
          This app does not recommend specific investments. It does not promise
          profits. It does not replace your own judgment or professional
          financial advice. It is a tool for structuring your own thinking.
        </p>
      </section>
    </main>
  );
}
