# Vehicle Maintenance Scheduler

This script fetches depot and vehicle data and computes the optimal maintenance schedule using available mechanic hours.

## Setup

1. Open a terminal in `vehicle_maintence_scheduler`
2. Run `npm install`
3. Run the scheduler with `npm run` or `node index.js`

## Environment

- `EVALUATION_API_BASE` - Optional base URL for depot/vehicle APIs.
- `EVALUATION_API_TOKEN` - Optional bearer token for protected API access.

## Behavior

- Fetches depots from `/depots`
- Fetches vehicles from `/vehicles`
- Computes the maximum total impact subject to available mechanic hours
- Logs results using the shared logging middleware
