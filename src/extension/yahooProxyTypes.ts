import type{ YahooChartResponse } from "../core/yahoo";

export type YahooProxyError = {
    kind: 'http' | 'network' | 'unknown';
    url: string;
    message: string;
    status?: number;
};

export type YahooFetchResp = { ok: true; json: YahooChartResponse } | { ok: false; error: YahooProxyError };