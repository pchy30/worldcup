"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NavbarLogout() {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-1 text-muted hover:text-white transition-colors duration-200 p-2 rounded-lg hover:bg-primary/60"
      title="Sign out"
    >
      <LogOut className="w-4 h-4" />
    </button>
  );
}
