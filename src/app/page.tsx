import Link from "next/link";
import { Button } from "@/components/ui";
import { PenLine, Dna, Clapperboard } from "lucide-react";

const features = [
  { icon: PenLine, title: "Exact-length scripts", desc: "English, Hinglish or Hindi. Length is verified by code, never by the model's claim." },
  { icon: Dna, title: "Script DNA with evidence", desc: "Every finding is labelled and linked to transcript evidence, so patterns stay separate from guesses." },
  { icon: Clapperboard, title: "Code-driven cloud rendering", desc: "Storyboard review, render, audio mastering and QA in the cloud. No AI video models." },
];

export default function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-accent text-sm font-bold text-white">V</div>
          <span className="font-semibold tracking-tight">VISTOON</span>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard"><Button variant="ghost">Sign in</Button></Link>
          <Link href="/dashboard"><Button>Get started</Button></Link>
        </div>
      </header>
      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="text-5xl font-semibold tracking-tight">From script to finished video, in one studio.</h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted">Write, analyze, storyboard and render original videos through a code-driven cloud pipeline.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/dashboard"><Button size="md">Open the studio</Button></Link>
        </div>
        <p className="mt-4 text-xs text-muted">Controlled beta · sign-up and billing are not live yet</p>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-24 md:grid-cols-3">
        {features.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="rounded-lg border border-line bg-surface p-5">
            <Icon className="mb-3 h-5 w-5 text-accent" aria-hidden />
            <h2 className="mb-1 text-sm font-semibold">{title}</h2>
            <p className="text-sm text-muted">{desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
