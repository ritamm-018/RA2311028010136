# Notification Backend Service

This backend service implements the Campus Notifications microservice and integrates the required logging middleware.

## Setup

1. Open a terminal in `notification_app_be`
2. Run `npm install`
3. Start the service with `npm start`

## Endpoints

- `POST /logs`
  - Body: `{ "stack": "backend", "level": "info", "package": "service", "message": "..." }`
  - Validates and records structured logs.

- `POST /notifications`
  - Body: `{ "userId":"1042", "type":"Placement", "title":"...", "body":"..." }`
  - Creates a notification.

- `GET /notifications`
  - Returns a sample notification list.

- `POST /maintenance/schedule`
  - Body: `{ "vehicles": [...], "availableHours": 135 }`
  - Computes the highest-impact maintenance assignment.

## Logging

This service uses the reusable `logging_middleware` module from the workspace root. Each request is logged with a structured payload.

## Notes

- Remote log delivery is enabled by default to the test server defined in the assignment.
- Set `DISABLE_REMOTE_LOGGING=true` to keep logs local during development.
