import type { CompanyId, ExchangeId } from "./types";

export interface WatchItem {
  symbol: string; // Yahoo Finance symbol
  label: string;
  company: CompanyId;
  exchange: ExchangeId;
}

export const WATCHLIST: readonly WatchItem[] = [
  { symbol: "ASML", label: "ASML on Nasdaq", company: "ASML", exchange: "NASDAQ" },
  { symbol: "ASML.AS", label: "ASML in Amsterdam", company: "ASML", exchange: "AMS" },
  { symbol: "688981.SS", label: "SMIC A-share, Shanghai", company: "SMIC", exchange: "SSE" },
  { symbol: "0981.HK", label: "SMIC H-share, Hong Kong", company: "SMIC", exchange: "HKEX" },
];

/** HKD per 1 CNY */
export const FX_SYMBOL = "CNYHKD=X";
export const SMIC_A = "688981.SS";
export const SMIC_H = "0981.HK";
