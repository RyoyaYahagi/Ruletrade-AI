# Frontend Design Reference

Use the local files under `frontend-design/` as the visual and interaction
reference for investment-facing UI work. They are mockups, not production code,
but they capture the intended product shape for rule creation and review.

## Reference Files

- `frontend-design/Ruletrade Rule Session.html`
  - Dense three-column rule session mockup.
  - Best reference for desktop workbench layout, persistent header, question
    queue, structured draft, warning list, evidence, and approval boundary.
- `frontend-design/Ruletrade Rule Session (Calm).html`
  - Calmer tabbed mockup.
  - Best reference when the implementation needs a less dense review surface or
    narrower responsive behavior.
- `frontend-design/Ruletrade Rule Session (Dense).html`
  - Alternate dense artifact for comparison.
- `frontend-design/app.jsx` and `frontend-design/app-calm.jsx`
  - Interaction and information architecture examples.
  - Treat seed data and component composition as reference material only.
- `frontend-design/components.jsx`
  - Shared mock components and status language.
  - Replace inline SVG examples with `lucide-react` icons in production when an
    equivalent icon exists.
- `frontend-design/styles.css` and `frontend-design/styles-calm.css`
  - Design token, spacing, density, border, and status color references.
  - Translate into existing Tailwind and shadcn-style patterns instead of
    copying CSS wholesale.

## Implementation Guidance

- Preserve the review-bench mental model: user intent, structured rule draft,
  AI review, evidence, unresolved items, and approval boundary should remain
  visually distinct.
- Make status visible near the rule title. `Draft`, `In review`, `Blocked`,
  `Approved`, and `Rejected` must not be hidden in secondary UI.
- Keep blockers and warnings close to the action they prevent. Approval actions
  should clearly show why they are disabled.
- Use compact operational layouts. Prefer dense, scan-friendly panels over
  marketing-style pages, oversized hero areas, or decorative visuals.
- Keep rule fields inspectable. Entry, exit, stop loss, take profit, position
  sizing, assumptions, evidence, and warnings should be separate UI concepts.
- Make unresolved fields actionable with precise labels such as unset, vague,
  warning, or blocker.
- Keep generated explanations separate from structured rule data. Explanations
  help review; they are not the source of truth.
- Include the financial boundary notice when AI review or investment-rule
  decisions are visible: AI assists with review and drafting; final decisions
  remain with the user.

## Production Constraints

- Follow the repository architecture: feature UI belongs in
  `src/features/<feature>/`, reusable primitives in `src/components/ui/`, shared
  schemas in `src/schemas/`, and shared types in `src/types/`.
- Keep domain validation and workflow transitions out of presentational
  components when practical.
- Browser components must not call provider SDKs or secret APIs directly.
- Use structured data from schemas/services to render warnings, evidence, and
  status. Do not parse prose to infer approval state.
- Match existing TypeScript, React, Tailwind, and shadcn-style component
  patterns.

## Before Shipping UI Changes

- Compare the affected screen against the closest mockup in `frontend-design/`.
- Verify that status, blockers, missing fields, evidence, and approval
  affordances are visible without reading a long chat transcript.
- Confirm that no copy implies financial advice, guaranteed results, or implicit
  approval.
- Run the smallest useful checks for the change, normally:

```bash
npm run lint
npm run typecheck
npm run build
```

