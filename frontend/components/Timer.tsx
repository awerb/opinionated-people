import { useEffect, useMemo, useRef, useState } from "react";

export interface TimerProps {
  duration: number;
  isRunning: boolean;
  syncedRemainingMs?: number;
  label?: string;
  onExpire?: () => void;
}

const formatRemaining = (remainingMs: number) => {
  const seconds = Math.ceil(remainingMs / 1000);
  return `${seconds}s`;
};

const Timer = ({ duration, isRunning, syncedRemainingMs, label, onExpire }: TimerProps) => {
  const durationMs = duration * 1000;
  const [remainingMs, setRemainingMs] = useState(durationMs);
  const previousSync = useRef<number | undefined>(undefined);

  useEffect(() => {
    setRemainingMs(durationMs);
    previousSync.current = undefined;
  }, [durationMs]);

  useEffect(() => {
    if (typeof syncedRemainingMs === "number" && syncedRemainingMs !== previousSync.current) {
      setRemainingMs(Math.max(0, Math.min(durationMs, syncedRemainingMs)));
      previousSync.current = syncedRemainingMs;
    }
  }, [syncedRemainingMs, durationMs]);

  useEffect(() => {
    if (!isRunning) {
      return;
    }
    const interval = window.setInterval(() => {
      setRemainingMs((current) => Math.max(0, current - 250));
    }, 250);
    return () => window.clearInterval(interval);
  }, [isRunning]);

  useEffect(() => {
    if (isRunning && remainingMs === 0) {
      onExpire?.();
    }
  }, [isRunning, remainingMs, onExpire]);

  const progress = useMemo(() => {
    if (durationMs === 0) {
      return 0;
    }
    return 100 - (remainingMs / durationMs) * 100;
  }, [durationMs, remainingMs]);

  return (
    <div className="timer">
      {label ? <p className="timer__label">{label}</p> : null}
      <div className="timer__progress">
        <div className="timer__progress-bar" style={{ width: `${progress}%` }} />
        <span className="timer__value">{formatRemaining(remainingMs)}</span>
      </div>
    </div>
  );
};

export default Timer;
