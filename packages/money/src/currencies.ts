import { EUR, GBP, GHS, USD, type DineroCurrency } from "dinero.js/currencies";

/**
 * Supported currency codes (lowercase keys match the products table values).
 * Add a new currency here + in the DB check constraints to extend support.
 */
export const CURRENCY_CODES = ["ghs", "usd", "eur", "gbp"] as const;

export type CurrencyCode = (typeof CURRENCY_CODES)[number];

/** The platform's default currency — Ghana Cedis. */
export const DEFAULT_CURRENCY: CurrencyCode = "ghs";

export type CurrencyConfig = {
  /** Lowercase key used in the products table and as the API enum. */
  key: CurrencyCode;
  /** ISO 4217 code used by the payments table and Intl formatting. */
  code: string;
  /** BCP 47 locale for `Intl.NumberFormat`. */
  locale: string;
  /** Minor-unit exponent (10^decimals = 1 major unit). */
  decimals: number;
  /** Dinero.js currency object. */
  dinero: DineroCurrency<number>;
  /** Human-readable name. */
  name: string;
};

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  ghs: {
    key: "ghs",
    code: "GHS",
    locale: "en-GH",
    decimals: 2,
    dinero: GHS,
    name: "Ghanaian Cedi",
  },
  usd: {
    key: "usd",
    code: "USD",
    locale: "en-US",
    decimals: 2,
    dinero: USD,
    name: "US Dollar",
  },
  eur: {
    key: "eur",
    code: "EUR",
    locale: "de-DE",
    decimals: 2,
    dinero: EUR,
    name: "Euro",
  },
  gbp: {
    key: "gbp",
    code: "GBP",
    locale: "en-GB",
    decimals: 2,
    dinero: GBP,
    name: "British Pound",
  },
};

/**
 * Normalizes an arbitrary input (lowercase key, uppercase ISO code, mixed
 * case, unknown code) to a supported CurrencyCode, falling back to the
 * default currency. Unknown codes never throw — they degrade to GHS.
 */
export function normalizeCurrencyCode(
  value: string | null | undefined,
): CurrencyCode {
  const key = value?.trim().toLowerCase() as CurrencyCode;
  return key in CURRENCIES ? key : DEFAULT_CURRENCY;
}

export function getCurrency(value: string | null | undefined): CurrencyConfig {
  return CURRENCIES[normalizeCurrencyCode(value)];
}

export function currencyCodeFor(value: string | null | undefined): CurrencyCode {
  return normalizeCurrencyCode(value);
}
