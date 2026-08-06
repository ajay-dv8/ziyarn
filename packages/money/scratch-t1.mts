import { toSnapshot } from "dinero.js";

import {
  DEFAULT_CURRENCY,
  addMoney,
  currencyCode,
  currencyCodeFor,
  formatDecimal,
  formatMoney,
  getCurrency,
  sumMoneyByCurrency,
} from "@repo/money";
import { CURRENCY_CODES } from "@repo/money/currencies";

let failed = 0;
const check = (name: string, actual: unknown, expected: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
};

check("CURRENCY_CODES[0] is ghs", CURRENCY_CODES[0], "ghs");
check("DEFAULT_CURRENCY", DEFAULT_CURRENCY, "ghs");
check("getCurrency(usd).code", getCurrency("usd").code, "USD");
check("getCurrency('GHS').key", getCurrency("GHS").key, "ghs");
check("unknown falls back to ghs", currencyCodeFor("xyz"), "ghs");

check("formatMoney GHS", formatMoney({ amountMinor: 125000, currency: "ghs" }), "GH₵1,250.00");
check("formatMoney USD from uppercase", formatMoney({ amountMinor: 25000, currency: "USD" }), "$250.00");
check("formatMoney EUR locale", formatMoney({ amountMinor: 129900, currency: "eur" }), "1.299,00\u00a0€");
check("formatMoney withCode", formatMoney({ amountMinor: 25000, currency: "USD" }, { withCode: true }), "$250.00 USD");
check("formatDecimal", formatDecimal({ amountMinor: 14999, currency: "usd" }), "149.99");
check("currencyCode uppercases", currencyCode({ amountMinor: 1, currency: "ghs" }), "GHS");

const sum = addMoney(
  { amountMinor: 1000, currency: "ghs" },
  { amountMinor: 250, currency: "ghs" },
);
check("addMoney amount", toSnapshot(sum).amount, 1250);
check("sumMoneyByCurrency mixed", sumMoneyByCurrency([
  { amountMinor: 10, currency: "usd" },
  { amountMinor: 20, currency: "USD" },
  { amountMinor: 5, currency: "ghs" },
]), { usd: 30, ghs: 5 });

console.log(failed === 0 ? "ALL PASS" : `${failed} FAILURES`);
