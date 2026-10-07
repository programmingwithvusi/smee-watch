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
  idea("NVDA", "NVIDIA", "Artificial intelligence", "NASDAQ"),
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
  idea("SPCX", "SpaceX", "Space exploration", "NASDAQ"),
];

/**
 * JSE-listed ETFs, bought in rand from a ZAR account: the same themes as WATCH_IDEAS with no EasyFX
 * conversion. The first four overlap the watchlist's AI and tech names; the last three are the most
 * bought ETFs on EasyEquities. Keep in step with WATCH_ETFS in src/config.ts.
 */
const etf = (symbol: string, name: string, theme: string): WatchItem => ({
  symbol,
  label: name,
  company: "ETF",
  exchange: "JSE",
  name,
  theme,
});

export const WATCH_ETFS: readonly WatchItem[] = [
  etf("STXNDQ.JO", "Satrix Nasdaq 100", "100 largest Nasdaq companies"),
  etf("ETF5IT.JO", "1nvest S&P 500 Info Tech", "US technology sector"),
  etf("IVYAI.JO", "Ivy EasyETFs AI Innovation", "AI, actively managed"),
  etf("EASYAI.JO", "EasyETFs AI World", "AI, actively managed"),
  etf("STX500.JO", "Satrix S&P 500", "500 largest US companies"),
  etf("STXWDM.JO", "Satrix MSCI World", "Developed-market shares"),
  etf("STX40.JO", "Satrix 40", "40 largest JSE companies"),
];

/** ZAR per 1 USD */
export const USD_ZAR = "ZAR=X";

/** HKD per 1 CNY */
export const FX_SYMBOL = "CNYHKD=X";
export const SMIC_A = "688981.SS";
export const SMIC_H = "0981.HK";
