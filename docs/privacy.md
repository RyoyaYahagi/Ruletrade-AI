# Privacy

Ruletrade-AI stores user-created investment rule data, watchlist notes, portfolio entries, uploaded documents, AI review results, and RAG embeddings.

Users can:

- export their data
- delete RAG memory
- delete uploaded documents
- request account deletion

RAG memory deletion removes embeddings and retrieval data, but does not remove the original rule or document unless the user separately deletes them.

Account deletion removes application data and storage objects before deleting the auth user.

Server-side admin operations must never expose service role keys to the browser.
