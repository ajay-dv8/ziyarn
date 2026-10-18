# Todo

## Documentation

- [x] Fix `plan/documentation-site.md` line 170: change `data-domain` to `data-slug`
- [x] Fix `plan/documentation-site.md` line 174: change `data-greeting` to `data-title` / `data-subtitle`
- [x] Fix `plan/documentation-site.md` lines 370-371: update example snippet to use `data-slug` instead of `data-domain`
- [x] Fix attribute table (lines 167-174): add `data-title`, `data-subtitle`, `data-position`; remove `data-greeting`

The same fixes have been applied to the live docs in
`apps/web/content/docs/` — see the commit history for 2026-10-17.

## Docs still worth writing

- [ ] A page for the **teams** feature — done (`docs/teams.mdx`), but the team
      switcher in the dashboard still needs documenting when it exists
- [ ] **Deployment**: check the env var list against `turbo.json` — it still
      names Stripe and Resend, while the platform is on Paystack and SMTP
- [ ] **API reference**: an API key system does not exist yet, so the page
      documents what is really there (public endpoints + dashboard endpoints)
