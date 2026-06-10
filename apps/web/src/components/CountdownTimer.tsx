"use client";

import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";

interface CountdownTimerProps {
  deadline: string; // ISO timestamp
  onExpired?: () => void;
}

function getSecondsRemaining(deadline: string): number {
  const diff = Math.floor(
    (new Date(deadline).getTime() - Date.now()) / 1000
  );
  return Math.max(0, diff);
}

export default function CountdownTimer({
  deadline,
  onExpired,
}: CountdownTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState<number>(
    getSecondsRemaining(deadline)
  );
  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
    setSecondsLeft(getSecondsRemaining(deadline));

    const interval = setInterval(() => {
      const remaining = getSecondsRemaining(deadline);
      setSecondsLeft(remaining);

      if (remaining === 0 && !firedRef.current) {
        firedRef.current = true;
        onExpiredRef.current?.();
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [deadline]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const display = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const isUrgent = secondsLeft <= 15;
  const isExpired = secondsLeft === 0;

  return (
    <div
      className={`
        inline-flex items-center gap-2 px-4 py-2 rounded-lg font-mono font-bold text-xl
        transition-colors duration-300
        ${
          isExpired
            ? "bg-gray-800 text-gray-500 border border-gray-700"
            : isUrgent
              ? "bg-red-900/40 text-red-400 border border-red-600/50 animate-pulse"
              : "bg-surface text-white border border-muted/30"
        }
      `}
      role="timer"
      aria-live="polite"
      aria-label={`${display} remaining`}
    >
      <Clock
        className={`w-5 h-5 ${
          isExpired ? "text-gray-500" : isUrgent ? "text-red-400" : "text-accent"
        }`}
      />
      <span>{isExpired ? "00:00" : display}</span>
    </div>
  );
}
