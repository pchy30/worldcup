"use client";

import { useRouter } from "next/navigation";
import CountdownTimer from "@/components/CountdownTimer";
import { ArrowRightLeft, Clock } from "lucide-react";

interface NextWindowCardProps {
  opensAt: string | null;
}

export default function NextWindowCard({ opensAt }: NextWindowCardProps) {
  const router = useRouter();

  if (!opensAt) {
    return (
      <div className="card mb-8">
        <div className="flex items-start gap-3 text-muted">
          <ArrowRightLeft className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">
            No transfer window is currently open. The next window will be scheduled automatically.
          </p>
        </div>
      </div>
    );
  }

  const opensDate = new Date(opensAt);
  const formattedDate = opensDate.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="card mb-8 border-blue-500/20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Next transfer window</p>
            <p className="text-xs text-muted mt-0.5">Opens {formattedDate}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted">
          <span className="text-xs">Opens in</span>
          <CountdownTimer
            deadline={opensAt}
            onExpired={() => router.refresh()}
          />
        </div>
      </div>
    </div>
  );
}
