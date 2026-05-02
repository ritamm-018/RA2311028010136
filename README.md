# Backend Assignment Workspace

This repository contains the complete backend implementation for the Affordmed backend track.

## Structure

- `logging_middleware/` - reusable structured logging middleware
- `notification_app_be/` - notification backend service with required API endpoints
- `vehicle_maintence_scheduler/` - scheduler script for vehicle maintenance assignment
- `notification_system_design.md` - assignment design document with stage-by-stage responses
- `package.json` - root workspace configuration

## Quick Start

### Install all dependencies
```bash
npm run install:all
```

### Start the backend service
```bash
npm run start:backend
```

### Run the scheduler
```bash
npm run start:scheduler
```

## Implementation Details

### Logging Middleware

Integrated into all backend services and routes. Each log entry includes:
- `stack`: `backend`
- `level`: `debug`, `info`, `warn`, `error`, or `fatal`
- `package`: One of the allowed package types (middleware, service, handler, etc.)
- `message`: Descriptive log message

Logs are sent to the evaluation server at: `http://20.207.122.201/evaluation-service/logs`

### Notification Backend Service

**Endpoints:**

- `POST /logs`
  - Validate and record structured backend logs
  - Body: `{ "stack": "backend", "level": "info", "package": "service", "message": "..." }`

- `POST /notifications`
  - Create a new notification
  - Body: `{ "userId": "1042", "type": "placement", "message": "Notification text" }`
  - Returns: notification object with id and timestamp

- `GET /notifications?userId=1042&page=1&limit=20`
  - Retrieve notifications with pagination
  - Query parameters: userId, page, limit
  - Returns: paginated list of notifications

- `POST /maintenance/schedule`
  - Compute optimal vehicle maintenance schedule
  - Body: `{ "vehicles": [...], "availableHours": 135 }`
  - Returns: selected tasks with total impact and duration

### Vehicle Maintenance Scheduler

Fetches depot and vehicle data from the evaluation API and computes the highest-impact maintenance selection using dynamic programming.

**Features:**
- Fetches from `/depots` and `/vehicles` endpoints
- Falls back to sample data if API is unavailable
- Logs all scheduling events through the middleware
- Outputs JSON report of selected maintenance tasks

## Assignment Stages

The complete assignment response is in `notification_system_design.md`:

- **Stage 1**: API Design and contract for campus notifications
- **Stage 2**: Database schema and storage choice analysis
- **Stage 3**: Query optimization and indexing strategy
- **Stage 4**: Performance improvements for notification fetching
- **Stage 5**: Reliable bulk notification delivery design
- **Stage 6**: Priority inbox design for top 10 notifications

## Submission Requirements

Before submitting:

1. ✅ Logging middleware is integrated into all services
2. ✅ All endpoints return proper JSON responses
3. ✅ Design document includes all 6 stages with detailed responses
4. ✅ Code is clean and follows naming conventions
5. ✅ Git repository is initialized and ready
6. ✅ Node modules are excluded from git via .gitignore

## Notes

- This is a backend-only implementation (no frontend code)
- Uses Node.js with Express framework
- Logging middleware is production-ready and sends logs to the evaluation server
- The scheduler is robust and handles API unavailability gracefully

