import { useState, useEffect, useRef } from "react";
import { Text } from "react-native";

interface CountdownTimerProps {
  deadline: string; // ISO timestamp
  onExpired?: () => void;
}

function formatTime(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function CountdownTimer({ deadline, onExpired }: CountdownTimerProps) {
  const deadlineMs = new Date(deadline).getTime();

  function getSecondsLeft() {
    return Math.max(0, Math.round((deadlineMs - Date.now()) / 1000));
  }

  const [secondsLeft, setSecondsLeft] = useState(getSecondsLeft);
  const expiredFired = useRef(false);

  useEffect(() => {
    expiredFired.current = false;
    setSecondsLeft(getSecondsLeft());

    const interval = setInterval(() => {
      const remaining = getSecondsLeft();
      setSecondsLeft(remaining);

      if (remaining === 0 && !expiredFired.current) {
        expiredFired.current = true;
        onExpired?.();
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [deadline]);

  const isUrgent = secondsLeft <= 15;

  return (
    <Text
      style={{ color: isUrgent ? "#EF4444" : "#FFFFFF" }}
      className={`font-bold text-base tabular-nums ${
        isUrgent ? "text-red-400" : "text-white"
      }`}
    >
      {formatTime(secondsLeft)}
    </Text>
  );
}
