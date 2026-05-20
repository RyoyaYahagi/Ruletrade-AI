# PWA

Ruletrade-AI Progressive Web App strategy.

## Scope

MVP PWA provides:

- Home screen installability
- Standalone display mode
- Offline fallback page
- Static asset caching
- Online/offline status indicator
- Install prompt (non-intrusive)

## What is cached

- Static HTML pages
- CSS / JS bundles
- Icons and images
- Offline fallback page

## What is NOT cached

- API responses
- Investment memos
- AI outputs
- Document text
- Portfolio details
- Private user data

## Service Worker

`public/sw.js` handles:

- Static asset caching
- Offline fallback for document requests
- API requests pass through without caching

## Install

Users can install Ruletrade from the browser menu or via the install prompt.

## Offline UX

When offline:

- Offline banner appears
- Document requests show offline fallback page
- API-dependent features show appropriate messages
- Reconnect automatically when online

## Mobile UX

- Touch targets are at least 44x44px
- Mobile navigation is accessible
- App shell layout works on small screens
