import {
  add,
  dinero,
  type Dinero,
  toDecimal,
} from "dinero.js";

import { currencyCodeFor, getCurrency } from "@repo/money/currencies";

export type MoneyInput = {
  /** Amount in minor units (pesewas / cents / pence). */
  amountMinor: number;
  /** Lowercase key or uppercase ISO code. Defaults to GHS. */
  currency?: string | null;
};

/**
 * Creates a Dinero object from minor units. Amounts must stay integers —
 * dinero never introduces floating-point rounding when given whole minor
 * units.
 */
export function toMoney(input: MoneyInput): Dinero<number> {
  return dinero({
    amount: Math.round(input.amountMinor),
    currency: getCurrency(input.currency).dinero,
  });
}

function majorValue(input: MoneyInput): number {
  const { decimals } = getCurrency(input.currency);
  return input.amountMinor / 10 ** decimals;
}

/**
 * Locale-aware money string, e.g. "GH₵1,299.00", "$50.00", "€1.299,00".
 * Compose the symbol/locale formatting with Intl.NumberFormat (Dinero.js
 * intentionally does not render currency symbols).
 */
export function formatMoney(
  input: MoneyInput,
  options: { withCode?: boolean } = {},
): string {
  const config = getCurrency(input.currency);
  const formatted = new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency: config.code,
    maximumFractionDigits: config.decimals,
  }).format(majorValue(input));
  return options.withCode ? `${formatted} ${config.code}` : formatted;
}

/**
 * Plain decimal string in major units, e.g. "1250.00". Use for form inputs,
 * prompts, and anywhere currency symbols are not wanted.
 */
export function formatDecimal(input: MoneyInput): string {
  return toDecimal(toMoney(input));
}

/** Currency code in the canonical uppercase ISO form, e.g. "GHS". */
export function currencyCode(input: MoneyInput): string {
  return getCurrency(input.currency).code;
}

/** Sums money inputs into a single Dinero Money (same-currency only). */
export function addMoney(...inputs: MoneyInput[]): Dinero<number> {
  const items = inputs.map(toMoney);
  const [first, ...rest] = items;
  if (!first) {
    return dinero({ amount: 0, currency: getCurrency(null).dinero });
  }
  return rest.reduce((acc, item) => add(acc, item), first);
}

/**
 * Groups minor-unit amounts by their normalized currency code, e.g. for
 * revenue aggregation where payments may mix currencies.
 */
export function sumMoneyByCurrency(
  inputs: MoneyInput[],
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const input of inputs) {
    const key = currencyCodeFor(input.currency);
    totals[key] = (totals[key] ?? 0) + Math.round(input.amountMinor);
  }
  return totals;
}