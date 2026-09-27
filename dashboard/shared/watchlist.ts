import type { CompanyId, ExchangeId } from "./types";

export interface WatchItem {
  symbol: string; // Yahoo Finance symbol
  label: string;
  company: CompanyId;
  exchange: ExchangeId;
  /** Company name, for listings where the exchange isn't the interesting part */
  name?: string;
  /** Why it's on the list, e.g. "AI" */
  theme?: string;
}

export const WATCHLIST: readonly WatchItem[] = [
  { symbol: "ASML", label: "ASML on Nasdaq", company: "ASML", exchange: "NASDAQ" },
  { symbol: "ASML.AS", label: "ASML in Amsterdam", company: "ASML", exchange: "AMS" },
  { symbol: "688981.SS", label: "SMIC A-share, Shanghai", company: "SMIC", exchange: "SSE" },
  { symbol: "0981.HK", label: "SMIC H-share, Hong Kong", company: "SMIC", exchange: "HKEX" },
];

/**
 * Future trades you're watching, in the order you ranked them. Kept separate from WATCHLIST so the
 * chip columns and SMIC premium are untouched. Keep in step with WATCH_IDEAS in src/config.ts, which
 * drives the Telegram alerts for the same stocks.
 */
const idea = (symbol: string, name: string, theme: string, exchange: ExchangeId): WatchItem => ({
  symbol,
  label: `${name} (${symbol})`,
  company: "WATCH",
  exchange,
  name,
  theme,
});

export const WATCH_IDEAS: readonly WatchItem[] = [
  idea("NVDA", "NVIDIA", "AI", "NASDAQ"),
  idea("VST", "Vistra", "Data centre power", "NYSE"),
  idea("ROK", "Rockwell Automation", "Robotics", "NYSE"),
  idea("IONQ", "IonQ", "Quantum computing", "NYSE"),
  idea("ENPH", "Enphase Energy", "Clean energy tech", "NASDAQ"),
  idea("CRWD", "CrowdStrike", "Cybersecurity", "NASDAQ"),
  idea("MSFT", "Microsoft", "Next-gen cloud", "NASDAQ"),
  idea("TSM", "TSMC", "Advanced chips", "NYSE"),
  idea("SOFI", "SoFi", "Fintech", "NASDAQ"),
  idea("OKLO", "Oklo", "Nuclear energy", "NYSE"),
  idea("AVGO", "Broadcom", "AI infrastructure", "NASDAQ"),
  idea("RKLB", "Rocket Lab", "Space technology", "NASDAQ"),
  idea("MU", "Micron", "High-bandwidth memory", "NASDAQ"),
];

/** HKD per 1 CNY */
export const FX_SYMBOL = "CNYHKD=X";
export const SMIC_A = "688981.SS";
export const SMIC_H = "0981.HK";
