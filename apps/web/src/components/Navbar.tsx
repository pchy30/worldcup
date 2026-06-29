import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Trophy, Users, HelpCircle, BarChart2, Calendar } from "lucide-react";
import NavbarLogout from "./NavbarLogout";
import MobileMenuClient from "./MobileMenuClient";
import LiveScoresBanner from "./LiveScoresBanner";

export default async function Navbar() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let displayName = "";
  let initial = "";

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single();

    displayName = profile?.username ?? user.email?.split("@")[0] ?? "Manager";
    initial = displayName.charAt(0).toUpperCase();
  }

  return (
    <nav className="bg-surface sticky top-0 z-50" style={{ borderBottom: "1px solid rgba(245,183,0,0.15)" }}>
      <LiveScoresBanner />
      {/* WC colour stripe */}
      <div className="h-0.5 w-full" style={{ background: "linear-gradient(90deg, #003DA5 0%, #F5B700 50%, #E5001B 100%)" }} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <Trophy className="w-7 h-7 text-accent group-hover:scale-110 transition-transform duration-200" />
            <span className="font-bold text-lg tracking-tight">
              <span className="text-white">World Cup</span>{" "}
              <span className="text-accent">Fantasy</span>
            </span>
          </Link>

          {/* Centre nav — desktop only */}
          <div className="hidden md:flex items-center gap-1">
            {user && (
              <Link
                href="/dashboard"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-primary/60 transition-colors duration-200 text-sm font-medium"
              >
                <Users className="w-4 h-4" />
                Leagues
              </Link>
            )}
            <Link
              href="/fixtures"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-primary/60 transition-colors duration-200 text-sm font-medium"
            >
              <Calendar className="w-4 h-4" />
              Fixtures
            </Link>
            <Link
              href="/players"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-primary/60 transition-colors duration-200 text-sm font-medium"
            >
              <BarChart2 className="w-4 h-4" />
              Players
            </Link>
            <Link
              href="/how-to-play"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-primary/60 transition-colors duration-200 text-sm font-medium"
            >
              <HelpCircle className="w-4 h-4" />
              How to Play
            </Link>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-accent text-primary font-bold text-sm flex items-center justify-center flex-shrink-0">
                    {initial}
                  </div>
                  <span className="hidden sm:block text-sm text-gray-300 font-medium max-w-[120px] truncate">
                    {displayName}
                  </span>
                </div>
                <NavbarLogout />
                <MobileMenuClient isLoggedIn={true} />
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/how-to-play"
                  className="hidden sm:block text-sm text-gray-300 hover:text-white px-3 py-2 rounded-lg hover:bg-primary/60 transition-colors duration-200 font-medium"
                >
                  How to Play
                </Link>
                <Link
                  href="/login"
                  className="text-sm text-gray-300 hover:text-white px-3 py-2 rounded-lg hover:bg-primary/60 transition-colors duration-200 font-medium"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="btn-primary text-sm py-2 px-4"
                >
                  Get started
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
