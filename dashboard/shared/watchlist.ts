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
  idea("MRNA", "Moderna", "mRNA medicines", "NASDAQ"),
  // Mariana Oncology (radioligand cancer therapy) has no listing of its own: Novartis owns it
  idea("NVS", "Novartis", "Cancer therapy, owns Mariana Oncology", "NYSE"),
  idea("ANG.JO", "AngloGold Ashanti", "Gold mining", "JSE"),
  // AI-infrastructure proxies: can't buy Anthropic/OpenAI directly, so these publicly traded
  // partners/investors are the closest indirect exposure.
  idea("AMZN", "Amazon", "AWS, invests in Anthropic", "NASDAQ"),
  idea("GOOGL", "Alphabet", "Invests in + hosts Anthropic on TPUs", "NASDAQ"),
  idea("AMD", "AMD", "Chip deal + stake in Anthropic", "NASDAQ"),
  idea("ASML", "ASML", "Lithography equipment, Track B", "NASDAQ"),
  // Added 2026-10-12: the rest of the EasyEquities AI/chip/infra micro-buy basket, plus a few new
  // ZAR single-stock buys. Watch-only -- see bankTracks.ts for what actually gets a bank-rung badge.
  idea("AMAT", "Applied Materials", "Chip equipment", "NASDAQ"),
  idea("ANET", "Arista Networks", "Data centre networking", "NYSE"),
  idea("GLW", "Corning", "Fibre optics", "NYSE"),
  idea("CDNS", "Cadence", "Chip design software", "NASDAQ"),
  idea("CARR", "Carrier Global", "Data centre cooling", "NYSE"),
  idea("COHR", "Coherent", "Optical components", "NYSE"),
  idea("CEG", "Constellation Energy", "Nuclear, data centre power", "NASDAQ"),
  idea("DELL", "Dell Technologies", "AI servers", "NYSE"),
  idea("HACK", "ETFMG Prime Cyber Security ETF", "Cybersecurity", "NYSE"),
  idea("ETN", "Eaton", "Data centre power management", "NYSE"),
  idea("EQIX", "Equinix", "Data centres", "NASDAQ"),
  idea("CLOU", "Global X Cloud Computing ETF", "Cloud computing", "NASDAQ"),
  idea("PAVE", "Global X US Infrastructure Development ETF", "US infrastructure", "NYSE"),
  idea("HPE", "Hewlett Packard Enterprise", "AI servers", "NYSE"),
  idea("KLAC", "KLA Corp", "Chip equipment", "NASDAQ"),
  idea("LRCX", "Lam Research", "Chip equipment", "NASDAQ"),
  idea("LITE", "Lumentum", "Optical components", "NASDAQ"),
  idea("MRVL", "Marvell Technology", "Custom AI silicon", "NASDAQ"),
  idea("MRK", "Merck", "Pharma", "NYSE"),
  idea("NEE", "NextEra Energy", "Data centre power", "NYSE"),
  idea("PANW", "Palo Alto Networks", "Cybersecurity", "NASDAQ"),
  idea("PWR", "Quanta Services", "Data centre + grid infrastructure", "NYSE"),
  idea("SKHY", "SK Hynix ADR", "High-bandwidth memory", "NASDAQ"),
  idea("SNDK", "Sandisk", "NAND flash", "NASDAQ"),
  idea("XSD", "SPDR S&P Semiconductor ETF", "Semiconductors", "NYSE"),
  idea("SMCI", "Super Micro Computer", "AI servers", "NASDAQ"),
  idea("SNPS", "Synopsys", "Chip design software", "NASDAQ"),
  idea("TSLA", "Tesla", "EVs, robotics", "NASDAQ"),
  idea("SMH", "VanEck Semiconductor ETF", "Semiconductors", "NASDAQ"),
  idea("VGT", "Vanguard Information Technology ETF", "US technology sector", "NYSE"),
  idea("VRT", "Vertiv Holdings", "Data centre cooling + power", "NYSE"),
  idea("WCLD", "WisdomTree Cloud Computing Fund", "Cloud computing", "NASDAQ"),
  idea("SOXX", "iShares PHLX Semiconductor ETF", "Semiconductors", "NASDAQ"),
  idea("IYW", "iShares U.S. Technology ETF", "US technology sector", "NYSE"),
  idea("APN.JO", "Aspen Pharmacare", "Pharma, JSE", "JSE"),
  idea("DSY.JO", "Discovery", "Insurance/health, JSE", "JSE"),
  idea("EPS.JO", "Eastern Platinum", "Speculative miner, JSE", "JSE"),
  idea("PRX.JO", "Prosus", "Tencent/Naspers holding, JSE", "JSE"),
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
  etf("STXMMT.JO", "Satrix Momentum ETF", "Equity momentum factor"),
  etf("SYGUS.JO", "Sygnia Itrix MSCI USA", "US large-cap tracker"),
];

/** ZAR per 1 USD */
export const USD_ZAR = "ZAR=X";

/** HKD per 1 CNY */
export const FX_SYMBOL = "CNYHKD=X";
export const SMIC_A = "688981.SS";
export const SMIC_H = "0981.HK";
