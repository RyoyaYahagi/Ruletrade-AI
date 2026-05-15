# Rate Limit

AI-related endpoints are rate limited.

MVP uses database counters.

Future production versions may use Redis or a hosted rate limiting service.

Rate limits protect:

- User experience
- AI API cost
- Abuse prevention
