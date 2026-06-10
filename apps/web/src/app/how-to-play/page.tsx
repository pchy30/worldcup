import Link from "next/link";
import {
  Trophy,
  UserPlus,
  Users,
  Zap,
  Target,
  Shield,
  ArrowRight,
  RefreshCcw,
  BarChart2,
  Clock,
  Crown,
  Star,
} from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Crown,
    title: "Create or join a league",
    description:
      "One person creates a league and shares the 8-character invite code. Everyone else joins using that code. You need at least 2 managers to start — up to 20.",
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
    border: "border-yellow-400/20",
  },
  {
    number: "02",
    icon: Zap,
    title: "Draft your 7-player squad",
    description:
      "The commissioner kicks off the draft. Picks go in snake order — 1→2→3→…→3→2→1→repeat — so it's fair. Each manager picks 7 players total from any World Cup nation.",
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    border: "border-blue-400/20",
  },
  {
    number: "03",
    icon: BarChart2,
    title: "Earn points as the tournament plays",
    description:
      "Your players score points automatically based on real match results. The leaderboard updates every 30 minutes during the tournament.",
    color: "text-green-400",
    bg: "bg-green-400/10",
    border: "border-green-400/20",
  },
  {
    number: "04",
    icon: RefreshCcw,
    title: "Use transfer windows",
    description:
      "Transfer windows open every few days. Drop players from eliminated nations and bring in in-form stars before your rivals do.",
    color: "text-purple-400",
    bg: "bg-purple-400/10",
    border: "border-purple-400/20",
  },
];

const scoringRules = [
  { icon: Target, label: "Goal scored (any outfield player)", points: "+4 pts", color: "text-green-400" },
  { icon: Target, label: "Goal scored (goalkeeper)", points: "+6 pts", color: "text-green-400" },
  { icon: Zap, label: "Assist", points: "+3 pts", color: "text-blue-400" },
  { icon: Shield, label: "Clean sheet (GK or DEF)", points: "+3 pts", color: "text-purple-400" },
];

const draftModes = [
  {
    icon: Zap,
    title: "Live Draft",
    description:
      "All managers pick at the same time with a countdown timer (30–120 seconds per pick). Miss your turn and it auto-skips. Fast and exciting.",
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
  },
  {
    icon: Clock,
    title: "Slow Draft",
    description:
      "Each manager has hours (12–48) to make their pick. Perfect for groups in different time zones or busy schedules.",
    color: "text-blue-400",
    bg: "bg-blue-400/10",
  },
];

const tips = [
  "Spread your picks across different nations — don't stack from one team that might go out early.",
  "GKs and defenders score clean sheet points. A top GK from a defensive side can rack up big points.",
  "Use early picks on clinical strikers — goals score the most points.",
  "Watch the transfer window: dropping players from eliminated teams early gives you better picks.",
  "In snake drafts, the manager picking last in round 1 picks first in round 2 — use that to grab two stars back-to-back.",
];

export default function HowToPlayPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Header */}
      <div className="text-center mb-10 sm:mb-14">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 bg-accent/15 rounded-full flex items-center justify-center border border-accent/30">
            <Trophy className="w-7 h-7 text-accent" />
          </div>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">How to Play</h1>
        <p className="text-muted text-base sm:text-lg">
          Everything you need to know to set up your league and win the tournament.
        </p>
      </div>

      {/* Steps */}
      <section className="mb-12">
        <h2 className="text-xl font-bold text-white mb-6">Getting started</h2>
        <div className="space-y-4">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className={`card border ${step.border} flex gap-4 items-start`}
              >
                <div className={`flex-shrink-0 w-10 h-10 ${step.bg} rounded-xl flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${step.color}`} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold ${step.color} tracking-widest`}>{step.number}</span>
                    <h3 className="font-bold text-white text-base">{step.title}</h3>
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Scoring */}
      <section className="mb-12">
        <h2 className="text-xl font-bold text-white mb-2">Points system</h2>
        <p className="text-muted text-sm mb-5">Points are calculated from real match data and updated automatically.</p>
        <div className="card p-0 overflow-hidden">
          {scoringRules.map((rule, i) => {
            const Icon = rule.icon;
            return (
              <div
                key={rule.label}
                className={`flex items-center justify-between px-4 py-3.5 gap-3 ${
                  i < scoringRules.length - 1 ? "border-b border-muted/15" : ""
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className={`w-4 h-4 flex-shrink-0 ${rule.color}`} />
                  <span className="text-sm text-gray-300 leading-snug">{rule.label}</span>
                </div>
                <span className="text-accent font-bold text-sm whitespace-nowrap">{rule.points}</span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted mt-3">
          Clean sheets apply only to GK and DEF. A clean sheet = 0 goals conceded by their team in 90 minutes.
        </p>
      </section>

      {/* Draft modes */}
      <section className="mb-12">
        <h2 className="text-xl font-bold text-white mb-2">Draft modes</h2>
        <p className="text-muted text-sm mb-5">Choose when creating your league — you can&apos;t change it after.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {draftModes.map((mode) => {
            const Icon = mode.icon;
            return (
              <div key={mode.title} className="card">
                <div className={`w-10 h-10 ${mode.bg} rounded-xl flex items-center justify-center mb-3`}>
                  <Icon className={`w-5 h-5 ${mode.color}`} />
                </div>
                <h3 className="font-bold text-white mb-1.5">{mode.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{mode.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Squad rules */}
      <section className="mb-12">
        <h2 className="text-xl font-bold text-white mb-2">Squad rules</h2>
        <div className="card space-y-3">
          <div className="flex items-start gap-3">
            <Users className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-300">Each manager drafts exactly <span className="text-white font-semibold">7 players</span>.</p>
          </div>
          <div className="flex items-start gap-3">
            <UserPlus className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-300">No position limits — you can pick all forwards if you want, but GK/DEF miss out on clean sheet points.</p>
          </div>
          <div className="flex items-start gap-3">
            <RefreshCcw className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-300">Transfer windows open periodically. Each window lets you swap players while it&apos;s open — first come, first served on undrafted players.</p>
          </div>
          <div className="flex items-start gap-3">
            <Shield className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-300">Players from <span className="text-white font-semibold">eliminated nations</span> stop earning points. Use transfer windows to replace them.</p>
          </div>
        </div>
      </section>

      {/* Tips */}
      <section className="mb-12">
        <h2 className="text-xl font-bold text-white mb-2">
          <span className="flex items-center gap-2"><Star className="w-5 h-5 text-accent" /> Pro tips</span>
        </h2>
        <div className="space-y-3">
          {tips.map((tip, i) => (
            <div key={i} className="flex items-start gap-3 bg-surface/60 border border-muted/20 rounded-xl px-4 py-3">
              <span className="text-accent font-bold text-sm flex-shrink-0 mt-0.5">{i + 1}.</span>
              <p className="text-sm text-gray-300 leading-relaxed">{tip}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <div className="card text-center py-8 border-accent/20">
        <Trophy className="w-8 h-8 text-accent mx-auto mb-3" />
        <h3 className="text-xl font-bold text-white mb-2">Ready to play?</h3>
        <p className="text-muted text-sm mb-6">Create a league and share the invite code with your mates.</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/league/new" className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center">
            Create a League
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/join" className="btn-secondary flex items-center gap-2 w-full sm:w-auto justify-center">
            Join a League
          </Link>
        </div>
      </div>
    </div>
  );
}
