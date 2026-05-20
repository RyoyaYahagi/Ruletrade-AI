# Schema Overview

The database is organized around user-owned resources.

## Core user tables

- app_users
- investor_profiles

## Rule tables

- rule_design_sessions
- rule_questions
- rule_answers
- rule_reviews
- rule_versions
- rule_quality_checks

## AI / RAG tables

- ai_run_logs
- rag_documents
- rag_chunks
- rag_retrieval_logs
- embedding_jobs

## Documents

- user_documents
- document_extraction_jobs
- document_summaries
- document_rag_links

## Safety / Legal

- compliance_review_logs
- financial_safety_events
- legal_acceptances
- legal_notices
