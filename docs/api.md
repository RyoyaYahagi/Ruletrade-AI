# Rule Session API

All endpoints require authentication. `userId` is never accepted from the request body.

## Endpoints

### `POST /api/rule-sessions`

Create a new rule design session.

**Request:**
```json
{
  "ticker": "6758",
  "companyName": "ソニーグループ",
  "market": "TSE",
  "currency": "JPY",
  "templateKey": "default"
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "sessionId": "uuid"
  }
}
```

### `GET /api/rule-sessions`

List rule design sessions for the authenticated user.

**Response:**
```json
{
  "ok": true,
  "data": {
    "sessions": [
      {
        "id": "uuid",
        "ticker": "6758",
        "company_name": "ソニーグループ",
        "status": "in_progress",
        "completion_score": null,
        "quality_gate_status": "not_reviewed",
        "question_count": 0,
        "max_question_count": 12,
        "created_at": "2026-05-14T10:00:00Z",
        "updated_at": "2026-05-14T10:00:00Z"
      }
    ]
  }
}
```

### `GET /api/rule-sessions/:sessionId`

Get session details, including questions, answers, latest review, and quality checks.

**Response:**
```json
{
  "ok": true,
  "data": {
    "session": { ... },
    "questions": [],
    "answers": [],
    "latestReview": null,
    "qualityChecks": []
  }
}
```

### `PATCH /api/rule-sessions/:sessionId`

Update session status or rule draft JSON.

**Request:**
```json
{
  "status": "paused",
  "ruleJson": { ... }
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "session": { ... }
  }
}
```

### `POST /api/rule-sessions/:sessionId/answers`

Save an answer to a question and update the rule draft.

**Request:**
```json
{
  "questionId": "uuid",
  "questionKey": "time_horizon",
  "answerText": "1年以上",
  "answerJson": {
    "value": "long_term",
    "label": "1年以上"
  }
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "answerId": "uuid",
    "sessionId": "uuid",
    "ruleJson": { ... }
  }
}
```

### `GET /api/rule-sessions/:sessionId/next-question`

Get the next pending question for the session.

**Response:**
```json
{
  "ok": true,
  "data": {
    "question": {
      "id": "uuid",
      "question_key": "investment_thesis",
      "question_text": "この銘柄を買いたい理由は何ですか？"
    }
  }
}
```

### `POST /api/rule-sessions/:sessionId/review`

Run AI review on the current rule draft.

**Response:**
```json
{
  "ok": true,
  "data": {
    "reviewId": "uuid",
    "completionScore": 72,
    "needsMoreInfo": true,
    "canFinalize": false,
    "nextQuestions": []
  }
}
```

### `POST /api/rule-sessions/:sessionId/finalize`

Finalize the rule session and save a version.

**Request:**
```json
{
  "force": false
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "sessionId": "uuid",
    "status": "finalized"
  }
}
```

## Error Response Format

All errors follow this shape:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "入力内容を確認してください。",
    "details": null,
    "requestId": "uuid",
    "retryable": false
  }
}
```

## Common Error Codes

| Code | Status | Meaning |
|------|--------|---------|
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `UNAUTHORIZED` | 401 | Not logged in |
| `NOT_FOUND` | 404 | Session not found or not owned |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
