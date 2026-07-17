# Investment Term Glossary / Inline Help

## Overview

A lightweight glossary system that explains investment terms inline via `i` mark popovers.

## Design Principles

- Explain concepts, never give investment advice
- Keep descriptions short and beginner-friendly
- Avoid words like "should buy", "will profit", "must sell"
- Support keyboard and screen reader access
- Mobile-friendly tap targets

## Data

Terms are defined in `src/features/glossary/glossary-terms.ts`.

Glossary terms remain one-term/one-definition inline help. Longer educational
explanations are stored separately as `knowledge_articles` and are linked by
exact `topic_keys` (for example, a wizard `question_key`). They are not part of
the user-owned RAG and are displayed only as general knowledge with source and
license metadata.

Each term has:

- `key`: machine identifier
- `label`: Japanese display name
- `shortDescription`: 1-2 sentence plain-language explanation
- `category`: rule | risk | review | evaluation
- `relatedTerms`: linked glossary keys

## Components

### InlineHelp

```tsx
import { InlineHelp } from "@/features/glossary/components/inline-help";

// Next to a form label
<label>
  最大投資比率 <InlineHelp termKey="max_investment_ratio" />
</label>;
```

### GlossaryTerm

```tsx
import { GlossaryTerm } from "@/features/glossary/components/glossary-term";

<GlossaryTerm termKey="stop_loss" />;
```

## Accessibility

- Icon-only button has `aria-label`
- Popover is announced by screen readers
- Keyboard focusable and ESC to close
- Minimum tap target 24x24px

## Future Expansion

The `GlossaryTerm` type is designed to support `descriptionsByLevel` for beginner / intermediate / advanced explanations when `experience_level` is implemented.
