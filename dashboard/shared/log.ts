type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/** Structured JSON logger for server-side code. One correlation id per request. */
export function createLogger(correlationId: string) {
  const threshold = ORDER[(process.env.LOG_LEVEL ?? "info").toLowerCase() as Level] ?? ORDER.info;
  const emit = (level: Level, message: string, context: Record<string, unknown> = {}): void => {
    if (ORDER[level] < threshold) return;
    const line = JSON.stringify({ timestamp: new Date().toISOString(), level, correlationId, message, ...context });
    (level === "error" ? process.stderr : process.stdout).write(line + "\n");
  };
  return {
    debug: (m: string, c?: Record<string, unknown>) => emit("debug", m, c),
    info: (m: string, c?: Record<string, unknown>) => emit("info", m, c),
    warn: (m: string, c?: Record<string, unknown>) => emit("warn", m, c),
    error: (m: string, c?: Record<string, unknown>) => emit("error", m, c),
  };
}
