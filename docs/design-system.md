# Design System

## Tokens

### Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--color-primary` | `#0ea5e9` | Primary actions |
| `--color-danger` | `#ef4444` | Errors, destructive actions |
| `--color-success` | `#22c55e` | Success states |
| `--color-warning` | `#f59e0b` | Warnings |

### Typography

| Token | Value |
|-------|-------|
| `--font-sans` | `system-ui, sans-serif` |
| `--font-mono` | `ui-monospace, monospace` |

### UX typography scale

Today と新規の状態表示コンポーネントでは、次のスケールを使う。既存画面の一括置換は行わない。

| 用途 | サイズ | 行間 |
|------|--------|------|
| 本文 | 16px | 1.7 |
| 補足 | 14px | 1.7 |
| 見出し | 20px / 24px | 1.3 |
| 数値強調 | 20px / 28px | 1.2 |

補足の 12px は、数値ラベルなど限定された補助情報にだけ使う。状態は色だけで表さず、必ずラベルとアイコンを併記する。

### Spacing

Base unit: 4px

| Token | Value |
|-------|-------|
| `--space-1` | `4px` |
| `--space-2` | `8px` |
| `--space-4` | `16px` |
| `--space-8` | `32px` |

## Component Guidelines

- Use existing UI components before creating new ones
- Components must be responsive
- Components must support dark mode
- Components must respect reduced motion
