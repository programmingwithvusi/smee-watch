import { promises as fs } from "node:fs";
import path from "node:path";
import { SEEN_RETENTION_DAYS } from "./config";

export interface State {
  /** item id -> first-seen epoch ms */
  seen: Record<string, number>;
  /** market alert key -> epoch ms */
  alerted: Record<string, number>;
  /** source name -> consecutive failures */
  failures: Record<string, number>;
  /** source name -> epoch ms of its first successful fetch (its existing items were baselined then) */
  seeded: Record<string, number>;
}

const STATE_DIR = path.resolve(process.cwd(), "state");

const empty = (): State => ({ seen: {}, alerted: {}, failures: {}, seeded: {} });

function isRecordOfNumbers(v: unknown): v is Record<string, number> {
  return typeof v === "object" && v !== null && Object.values(v).every((x) => typeof x === "number");
}

/** Validate untrusted JSON from disk instead of trusting its shape. */
export function parseState(raw: string): State {
  const data: unknown = JSON.parse(raw);
  if (typeof data !== "object" || data === null) throw new Error("state file is not an object");
  const d = data as Record<string, unknown>;
  const state = empty();
  if (isRecordOfNumbers(d.seen)) state.seen = d.seen;
  if (isRecordOfNumbers(d.alerted)) state.alerted = d.alerted;
  if (isRecordOfNumbers(d.failures)) state.failures = d.failures;
  if (isRecordOfNumbers(d.seeded)) state.seeded = d.seeded;
  return state;
}

export function prune(state: State, now = Date.now()): void {
  const cutoff = now - SEEN_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  for (const bucket of [state.seen, state.alerted]) {
    for (const [k, ts] of Object.entries(bucket)) if (ts < cutoff) delete bucket[k];
  }
}

export interface LoadedState {
  state: State;
  save: () => Promise<void>;
}

/** Loads state/<name>.json and returns a save() that only writes when something changed. */
export async function openState(name: string): Promise<LoadedState> {
  const file = path.join(STATE_DIR, `${name}.json`);
  let before = "";
  let state = empty();
  try {
    before = await fs.readFile(file, "utf8");
    state = parseState(before);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  return {
    state,
    save: async () => {
      prune(state);
      const after = JSON.stringify(state, null, 2) + "\n";
      if (after === before) return;
      await fs.mkdir(STATE_DIR, { recursive: true });
      await fs.writeFile(file, after, "utf8");
    },
  };
}
