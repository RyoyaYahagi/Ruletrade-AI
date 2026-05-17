# Error Handling

Ruletrade-AI uses a unified API response format.

Expected errors are represented by `AppError`.

Unexpected errors are converted to `INTERNAL_ERROR`.

Each API request gets a `requestId`.

Errors are stored in `api_error_logs`.

AI failures must not delete user input or rule drafts.
