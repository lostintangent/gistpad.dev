import type { ResponseUsage } from "openai/resources/responses/responses";

export const PRICE_AS_OF = "2026-11-19";
export const PRICE_TIER = "standard";

export interface UsageEntry {
  raw: ResponseUsage | null;
  estimated_usd: number | null;
  invalid: string | null;
}

const RATES: Record<string, { input: number; cached: number; output: number }> = {
  "gpt-6-luna": { input: 0.1, cached: 0.01, output: 0.5 },
  "gpt-6.1-terra": { input: 1, cached: 0.05, output: 5 },
  "gpt-6.1-sol": { input: 2, cached: 0.1, output: 10 },
  "gpt-6.2-sol": { input: 2, cached: 0.1, output: 10 },
  "gpt-6.2-astra": { input: 8, cached: 0.4, output: 40 },
};

/** Preserve provider usage; only pricing is derived here. Missing counts cannot imply free usage. */
export function readUsage(raw: ResponseUsage | undefined, model: string): UsageEntry {
  const rates = RATES[model];
  const input = raw?.input_tokens ?? NaN;
  const cached = raw?.input_tokens_details?.cached_tokens ?? NaN;
  const written = raw?.input_tokens_details?.cache_write_tokens ?? NaN;
  const writeDetails = raw?.input_tokens_details?.cache_write_tokens_details;
  const write30 = writeDetails?.ttl_30m_tokens ?? (written === 0 ? 0 : NaN);
  const write12 = writeDetails?.ttl_12h_tokens ?? (written === 0 ? 0 : NaN);
  const output = raw?.output_tokens ?? NaN;
  const counts = [input, cached, written, write30, write12, output];
  const invalid =
    !counts.every((count) => Number.isSafeInteger(count) && count >= 0) ||
    cached + written > input ||
    write30 + write12 !== written;

  if (!rates || invalid) {
    return {
      raw: raw ?? null,
      estimated_usd: null,
      invalid: !rates
        ? `No Standard prices recorded for ${model}`
        : "Missing or inconsistent usage",
    };
  }

  return {
    raw: raw ?? null,
    estimated_usd:
      ((input - cached - written) * rates.input +
        cached * rates.cached +
        write30 * rates.input * 1.25 +
        write12 * rates.input * 2.5 +
        output * rates.output) /
      1_000_000,
    invalid: null,
  };
}

export function addUsd(values: Array<number | null>) {
  if (values.length === 0) return null;
  let total = 0;
  for (const value of values) {
    if (value == null) return null;
    total += value;
  }
  return total;
}
