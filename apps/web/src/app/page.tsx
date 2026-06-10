import Link from "next/link";
import { Trophy, Zap, BarChart2, RefreshCcw, ArrowRight, HelpCircle } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Live Draft Room",
    description:
      "Real-time snake draft with countdown timers. Pick before the clock runs out or your turn auto-skips.",
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
  },
  {
    icon: BarChart2,
    title: "Real-Time Points",
    description:
      "Live leaderboard updates as goals, assists, and clean sheets roll in during every match.",
    color: "text-green-400",
    bg: "bg-green-400/10",
  },
  {
    icon: RefreshCcw,
    title: "Transfer Windows",
    description:
      "Swap out players between tournament rounds. Drop eliminated teams and pick up in-form stars.",
    color: "text-blue-400",
    bg: "bg-blue-400/10",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Hero */}
      <section className="relative flex-1 flex flex-col items-center justify-center text-center px-4 py-24 overflow-hidden">
        {/* Background gradient */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-primary via-surface/30 to-primary" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-accent/5 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto">
          {/* Trophy icon */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="w-20 h-20 bg-accent/15 rounded-full flex items-center justify-center border border-accent/30">
                <Trophy className="w-10 h-10 text-accent" />
              </div>
              <div className="absolute -inset-2 rounded-full border border-accent/10 animate-ping opacity-30" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6">
            <span className="text-white">World Cup</span>
            <br />
            <span className="text-accent">Fantasy</span>
          </h1>

          {/* Tagline */}
          <p className="text-xl sm:text-2xl text-gray-400 mb-10 font-medium text-balance">
            Draft your squad. Own the tournament.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/league/new"
              className="btn-primary flex items-center gap-2 text-base w-full sm:w-auto justify-center"
            >
              Create a League
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/join"
              className="btn-secondary flex items-center gap-2 text-base w-full sm:w-auto justify-center"
            >
              Join a League
            </Link>
          </div>
          <div className="mt-5">
            <Link
              href="/how-to-play"
              className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-accent transition-colors duration-200"
            >
              <HelpCircle className="w-4 h-4" />
              How does it work?
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-surface/50 border-t border-muted/20 py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-4">
            Everything you need
          </h2>
          <p className="text-center text-muted mb-12 text-lg">
            A full fantasy draft experience built for the World Cup.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="card hover:border-muted/60 transition-colors duration-200 group"
                >
                  <div
                    className={`w-12 h-12 ${feature.bg} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200`}
                  >
                    <Icon className={`w-6 h-6 ${feature.color}`} />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-muted/20 py-6 px-4 text-center text-muted text-sm">
        <p>
          &copy; {new Date().getFullYear()} World Cup Fantasy. Built for the
          beautiful game.
        </p>
      </footer>
    </div>
  );
}
