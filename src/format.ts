// Display helpers. All times are shown in UK local time (the market's clock).

const UK = "Europe/London";

const dayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: UK, day: "numeric", month: "short" });
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: UK,
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const longDayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: UK, weekday: "short", day: "numeric", month: "short" });

export const fmtDay = (ms: number) => dayFmt.format(ms);
export const fmtDateTime = (iso: string | number) => dateTimeFmt.format(typeof iso === "string" ? Date.parse(iso) : iso);
export const fmtLongDay = (isoDate: string) => longDayFmt.format(Date.parse(`${isoDate}T12:00:00Z`));

/** MW value shown as GW with one decimal (e.g. 2107 -> "2.1 GW"). */
export function fmtGW(mw: number | null | undefined, opts: { signed?: boolean } = {}): string {
  if (mw === null || mw === undefined || Number.isNaN(mw)) return "–";
  const gw = mw / 1000;
  const sign = opts.signed && gw > 0 ? "+" : "";
  return `${sign}${gw.toFixed(1)} GW`;
}

/** MW with thousands separators (e.g. 12345 -> "12,345 MW"). */
export function fmtMW(mw: number | null | undefined, opts: { signed?: boolean } = {}): string {
  if (mw === null || mw === undefined || Number.isNaN(mw)) return "–";
  const sign = opts.signed && mw > 0 ? "+" : "";
  return `${sign}${Math.round(mw).toLocaleString("en-GB")} MW`;
}

export const fmtPct = (v: number | null | undefined, digits = 0) =>
  v === null || v === undefined ? "–" : `${v.toFixed(digits)}%`;

export const fmtHours = (h: number | null | undefined) => (h === null || h === undefined ? "–" : `${h.toFixed(h < 10 ? 1 : 0)} h`);
