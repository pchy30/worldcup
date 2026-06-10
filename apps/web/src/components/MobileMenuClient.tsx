"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, LayoutDashboard, HelpCircle } from "lucide-react";

interface MobileMenuClientProps {
  isLoggedIn: boolean;
}

export default function MobileMenuClient({ isLoggedIn }: MobileMenuClientProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg text-muted hover:text-white hover:bg-primary/60 transition-colors"
        aria-label="Toggle menu"
      >
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {open && (
        <div className="absolute top-16 left-0 right-0 bg-surface border-b border-muted/30 shadow-xl z-40">
          <nav className="flex flex-col py-2 px-4">
            {isLoggedIn && (
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-lg text-gray-300 hover:text-white hover:bg-primary/60 transition-colors text-sm font-medium"
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>
            )}
            <Link
              href="/how-to-play"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-3 rounded-lg text-gray-300 hover:text-white hover:bg-primary/60 transition-colors text-sm font-medium"
            >
              <HelpCircle className="w-4 h-4" />
              How to Play
            </Link>
          </nav>
        </div>
      )}
    </div>
  );
}
