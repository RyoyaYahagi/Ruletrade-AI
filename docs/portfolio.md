# Portfolio MVP

Portfolio MVP allows users to manually enter holdings and review portfolio-level risks.

## Overview

- Users manually input holdings (no brokerage integration)
- No price API integration in MVP
- Portfolio values are user-input or manually updated
- AI reviews portfolio for:
  - Concentration risk
  - Sector/theme bias
  - Cash buffer adequacy
  - Missing trade rules
  - Missing risk management rules

## AI Policy

The AI does **not** recommend buying or selling. It only points out gaps, biases, and missing rules.

## Routes

- `/portfolio` - Portfolio dashboard
- `/portfolio/positions/new` - Add new position

## API Endpoints

- `GET /api/portfolio` - Get or create main portfolio
- `POST /api/portfolio` - Create portfolio (MVP: auto-created)
- `GET /api/portfolio/positions` - List positions
- `POST /api/portfolio/positions` - Create position
- `POST /api/portfolio/review` - Run AI portfolio review

## Out of Scope

- Brokerage integration
- Price API integration
- Automatic valuation updates
- Dividend tracking
- Sector auto-classification
- CSV import
- Asset history charts
- Rebalancing support
- Order execution
- Tax calculation
- NISA management
