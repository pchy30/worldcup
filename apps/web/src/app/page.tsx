import Link from "next/link";
import { Trophy, Zap, BarChart2, RefreshCcw, ArrowRight, HelpCircle } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Live Draft Room",
    description:
      "Real-time snake draft with countdown timers. Pick before the clock runs out or your turn auto-skips.",
    color: "text-wc-gold",
    bg: "bg-wc-gold/10",
    border: "hover:border-wc-gold/40",
  },
  {
    icon: BarChart2,
    title: "Real-Time Points",
    description:
      "Live leaderboard updates as goals, assists, and clean sheets roll in during every match.",
    color: "text-green-400",
    bg: "bg-green-400/10",
    border: "hover:border-green-400/40",
  },
  {
    icon: RefreshCcw,
    title: "Transfer Windows",
    description:
      "Swap out players between tournament rounds. Drop eliminated teams and pick up in-form stars.",
    color: "text-blue-400",
    bg: "bg-wc-blue/20",
    border: "hover:border-wc-blue/40",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Hero */}
      <section className="relative flex-1 flex flex-col items-center justify-center text-center px-4 py-20 sm:py-28 overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          {/* Deep gradient base */}
          <div className="absolute inset-0 bg-gradient-to-b from-primary via-surface/40 to-primary" />
          {/* Blue glow top-left */}
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-wc-blue/20 rounded-full blur-3xl" />
          {/* Red glow top-right */}
          <div className="absolute -top-32 -right-32 w-[400px] h-[400px] bg-wc-red/10 rounded-full blur-3xl" />
          {/* Gold glow centre */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-accent/5 rounded-full blur-3xl" />
          {/* Thin WC stripe across top */}
          <div className="absolute top-0 left-0 right-0 h-1"
            style={{ background: "linear-gradient(90deg, #003DA5 0%, #F5B700 50%, #E5001B 100%)" }}
          />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto">
          {/* Trophy icon */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center border-2 border-accent/50 shadow-glow-gold"
                style={{ background: "radial-gradient(circle, rgba(245,183,0,0.15) 0%, rgba(10,22,40,0.8) 100%)" }}
              >
                <Trophy className="w-10 h-10 sm:w-12 sm:h-12 text-accent drop-shadow-lg" />
              </div>
              <div className="absolute -inset-2 rounded-full border border-accent/20 animate-ping opacity-40" />
              <div className="absolute -inset-4 rounded-full border border-wc-blue/10 animate-ping opacity-20" style={{ animationDelay: "0.5s" }} />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight mb-4 leading-none">
            <span className="text-white">World Cup</span>
            <br />
            <span className="text-shimmer">Fantasy</span>
          </h1>

          {/* WC 2026 badge */}
          <div className="flex justify-center mb-6">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase border"
              style={{
                background: "linear-gradient(90deg, rgba(0,61,165,0.3), rgba(229,0,27,0.2))",
                borderColor: "rgba(245,183,0,0.3)",
                color: "#F5B700",
              }}
            >
              ⚽ FIFA World Cup 2026
            </span>
          </div>

          {/* Tagline */}
          <p className="text-lg sm:text-xl text-gray-400 mb-10 font-medium text-balance">
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
      <section className="relative border-t py-16 sm:py-20 px-4 overflow-hidden"
        style={{
          borderColor: "rgba(245,183,0,0.15)",
          background: "linear-gradient(180deg, rgba(17,34,64,0.8) 0%, rgba(10,22,40,1) 100%)",
        }}
      >
        {/* Subtle blue glow behind section */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[200px] bg-wc-blue/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-white mb-3">
            Everything you need
          </h2>
          <p className="text-center text-muted mb-10 sm:mb-12">
            A full fantasy draft experience built for the World Cup.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className={`card border border-white/10 ${feature.border} transition-all duration-200 group hover:shadow-lg`}
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
      <footer className="border-t py-6 px-4 text-center text-muted text-sm" style={{ borderColor: "rgba(245,183,0,0.1)" }}>
        <div className="flex items-center justify-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-wc-blue" />
          <div className="w-2 h-2 rounded-full bg-accent" />
          <div className="w-2 h-2 rounded-full bg-wc-red" />
        </div>
        <p>&copy; {new Date().getFullYear()} World Cup Fantasy. Built for the beautiful game.</p>
        <p className="text-muted/50 text-xs mt-1">Built and engineered by Choudhury &amp; Chowdhury</p>
      </footer>
    </div>
  );
}
