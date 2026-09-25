import { randomUUID } from "node:crypto";

type Level = "debug" | "info" | "warn" | "error";

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/** One id per process run so every log line from a run can be correlated. */
export const correlationId = randomUUID();

function threshold(): number {
  const raw = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  return ORDER[raw as Level] ?? ORDER.info;
}

function emit(level: Level, message: string, context: Record<string, unknown> = {}): void {
  if (ORDER[level] < threshold()) return;
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    correlationId,
    message,
    ...context,
  });
  (level === "error" ? process.stderr : process.stdout).write(line + "\n");
}

export const log = {
  debug: (m: string, c?: Record<string, unknown>) => emit("debug", m, c),
  info: (m: string, c?: Record<string, unknown>) => emit("info", m, c),
  warn: (m: string, c?: Record<string, unknown>) => emit("warn", m, c),
  error: (m: string, c?: Record<string, unknown>) => emit("error", m, c),
};

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
