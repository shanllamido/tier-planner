import { ClientPlanner } from "@/components/ClientPlanner";

export default function Home() {
  return (
    <main className="flex-1">
      <header className="mx-auto w-full max-w-[1440px] px-4 pt-8 pb-5 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">AI product planning</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Tier Planner</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Decide what to build and how to sell it: <b>value first, then quality, then cost.</b> Describe an AI product, sort its features into
          plans, and pick a Claude model for each. You see which features customers would pay for, which need evals before launch, and whether
          the plan pays off.
        </p>
      </header>
      <ClientPlanner />
      <footer className="mx-auto max-w-[1440px] px-4 pb-8 text-xs text-slate-400 sm:px-6">
        Built by Shanelle Llamido with Claude Code ·{" "}
        <a href="https://github.com/shanllamido/tier-planner" className="underline hover:text-slate-600">Source on GitHub</a>
      </footer>
    </main>
  );
}
