# VISTOON: permanent development rules (summary of the project instructions)

- Authority: `VISTOON_COMPLETE_30_DAY_PLAN_SECURITY_UPGRADED.md`. Follow its day order; the schedule is a target, never a reason to skip a requirement.
- Reuse the existing what-if-animation (Remotion) renderer. No AI video models. No local rendering in the MVP. Users never upload code.
- Security is continuous: deny by default, server-side authorization on every operation, RLS on every table, no secrets in the browser or Git.
- A feature is done only with UI + API + validation + persistence + authorization + error handling + tests + docs.
- Status values: NOT_STARTED, IN_PROGRESS, BLOCKED, IMPLEMENTED, TESTING, VERIFIED. VERIFIED requires real test evidence.
- Never fabricate results. Never hide errors by disabling checks. Fix root causes.
- Ask before: destructive migrations, deleting user data, production deploys, paid infrastructure, irreversible external actions.
- Never claim "unhackable". Public release only after every security gate passes; otherwise controlled beta.
- Run before finishing: `npm run typecheck && npm test && npm run test:rls && npm run build`.
