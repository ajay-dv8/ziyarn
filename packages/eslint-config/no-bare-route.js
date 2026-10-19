/**
 * A route written by hand instead of imported from the app's route constants.
 *
 * Both Next apps keep their paths in one place (`@/constants/routes` in web,
 * `constants/routes.ts` in admin). Naming them there is only half the job; this
 * is the other half, so the next feature that writes "/dashboard/whatever"
 * fails lint instead of quietly becoming a second source of truth.
 *
 * Two AST shapes carry a path:
 *
 * - `Literal` — `"/dashboard/domains"`.
 * - `TemplateElement` — the first chunk of `` `${origin}/api/chat` ``, which is
 *   where the absolute URLs built outside the web app used to hide. `cooked` is
 *   preferred over `raw` so `"\u002fdashboard"` cannot slip past.
 *
 * This is a visitor rather than a `no-restricted-syntax` selector because
 * esquery cannot express it: attribute selectors have no prefix operator
 * (`^=` throws "Unknown operator"), and a selector regex cannot contain the
 * leading slash — `/^\/dashboard/` is parsed as the regex `^\/` followed by
 * garbage. Forty lines of visitor is the smaller surprise.
 */

/** Escape the regex metacharacters a path prefix could plausibly contain. */
function escapeForRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * @param {object} options
 * @param {string[]} options.prefixes First segments that only ever begin an
 *   internal path, e.g. `"/dashboard"`. A string starting with one of these and
 *   then a `/` or the end belongs in the route constants.
 * @param {string[]} [options.ignores] Files the guard cannot apply to. Each one
 *   needs a reason at the call site.
 * @param {string[]} [options.files]
 * @returns {import("eslint").Linter.Config}
 */
export function noBareRoute({
  prefixes,
  ignores = [],
  files = ["**/*.ts", "**/*.tsx"],
}) {
  const pattern = new RegExp(
    `^(?:${prefixes.map(escapeForRegExp).join("|")})(?:/|$)`,
  );

  const rule = {
    meta: {
      type: "problem",
      schema: [],
      messages: {
        bare: "`{{path}}` is a route. Import it from the route constants instead of writing it here.",
      },
    },
    create(context) {
      function check(node, text) {
        if (typeof text === "string" && pattern.test(text)) {
          context.report({ node, messageId: "bare", data: { path: text } });
        }
      }

      return {
        Literal(node) {
          check(node, node.value);
        },
        TemplateElement(node) {
          check(node, node.value.cooked ?? node.value.raw);
        },
      };
    },
  };

  return {
    files,
    ignores,
    plugins: { routes: { rules: { "no-bare-route": rule } } },
    rules: { "routes/no-bare-route": "error" },
  };
}
