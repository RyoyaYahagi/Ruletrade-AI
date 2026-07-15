# Practice Mode / Education

## Overview

Virtual trading environment for learning investment rule design without real money.

## Philosophy

- Practice mode is clearly separated from real trading
- No real brokerage integration or order execution
- Focus on rule compliance, not profit/loss
- AI acts as a reviewer/teacher, not an advisor
- No leverage, derivatives, or crypto by default

## Tables

| Table               | Purpose                                      |
| ------------------- | -------------------------------------------- |
| `practice_sessions` | User's practice session with virtual balance |
| `virtual_trades`    | Paper trades within a session                |
| `practice_rules`    | Rules created for practice                   |
| `lesson_progress`   | Lesson completion tracking                   |

## API Endpoints

| Endpoint                      | Methods            | Description            |
| ----------------------------- | ------------------ | ---------------------- |
| `/api/practice/sessions`      | GET, POST          | List / create sessions |
| `/api/practice/sessions/[id]` | GET, PATCH, DELETE | Manage session         |
| `/api/practice/trades`        | GET, POST          | List / create trades   |
| `/api/practice/trades/[id]`   | GET, PATCH, DELETE | Manage trade           |
| `/api/practice/rules`         | GET, POST          | List / create rules    |
| `/api/practice/rules/[id]`    | GET, PATCH, DELETE | Manage rule            |
| `/api/practice/lessons`       | GET, POST          | List / track lessons   |
| `/api/practice/lessons/[id]`  | GET, PATCH, DELETE | Manage progress        |

## Safety

- Virtual balance only (default ¥1,000,000)
- No real money or brokerage connections
- ownership checks enforce user isolation
- Rule compliance score (0-100) for learning feedback
