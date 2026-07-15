# Ownership model

SQLite does not provide a database-hosted row security layer. Ruletrade-AI
therefore enforces user isolation at the server boundary.

For user-owned data, services and API routes must use the authenticated
session's user ID in every read, update, and delete condition. Admin operations
must go through an explicit server-only authorization check.
