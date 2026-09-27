# Changelog

## [Unreleased]

### Changed

- Replaced the investment-rule workbench with a single-user investment decision journal.
- Use server-side Gemini with Zod validation and SQLite through Drizzle.
- Align review and release templates with the current product scope.
- Retain `frontend-design/` as historical design reference material.

### Features

- Text and voice capture with confirmation before saving.
- Preserve original input and append each new thought to a stock timeline.
- Compare current thinking with recorded decisions and save personal reflections.
- Record transactions, allowing unknown prices to remain empty.
- Show due reviews when the app opens.

### Scope

The app does not provide investment advice or buy/sell recommendations. It has no authentication, ownership layer, scheduled notifications, or order execution. This file describes the current journal; earlier development history remains available in Git.
