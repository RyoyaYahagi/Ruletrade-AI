# Error Codes

## Auth

| Code         | Meaning                                |
| ------------ | -------------------------------------- |
| UNAUTHORIZED | User is not logged in                  |
| FORBIDDEN    | User is not allowed to access resource |

## Validation

| Code             | Meaning                            |
| ---------------- | ---------------------------------- |
| VALIDATION_ERROR | Request body or params are invalid |

## AI

| Code               | Meaning                                  |
| ------------------ | ---------------------------------------- |
| AI_OUTPUT_INVALID  | AI output did not match schema           |
| SAFETY_BLOCKED     | Safety check blocked output              |
| COMPLIANCE_BLOCKED | Financial compliance gate blocked output |

## Billing

| Code                    | Meaning                        |
| ----------------------- | ------------------------------ |
| USAGE_LIMIT_EXCEEDED    | Monthly usage limit exceeded   |
| RESOURCE_LIMIT_EXCEEDED | Stored resource limit exceeded |
