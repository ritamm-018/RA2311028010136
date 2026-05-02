This repository contains my complete backend implementation for the Affordmed backend track. I have tried to keep the structure clean, practical, and easy to understand, so that anyone reviewing it can quickly navigate through the components and understand how everything works together.

Project Structure

The project is divided into a few clear modules, each handling a specific responsibility:

logging_middleware/ A reusable structured logging system that is plugged into all services.
notification_app_be/ The main backend service that exposes APIs for managing notifications.
vehicle_maintence_scheduler/ A scheduler script that calculates optimal maintenance tasks for vehicles.
notification_system_design.md Contains detailed answers for all assignment stages (system design, scaling, optimization, etc.).
package.json Root workspace configuration to manage scripts and dependencies.
Screenshots

To make evaluation easier, I have included screenshots of working outputs:

Vehicle Maintenance Scheduler screenshots are inside: vehicle_maintence_scheduler/
Notification Backend screenshots are inside: notification_app_be/
Getting Started
Install Dependencies

Run the following command to install all dependencies across the workspace:

npm run install:all

Start Backend Service

To start the notification backend:

npm run start:backend

Run Scheduler

To execute the vehicle maintenance scheduler:

npm run start:scheduler

Implementation Details
Logging Middleware

The logging middleware is integrated across all services and routes.

Each log follows a structured format:

stack: always set to "backend"
level: debug, info, warn, error, fatal
package: identifies the source (middleware, service, handler, etc.)
message: meaningful description of the event

All logs are sent to the evaluation server:

http://20.207.122.201/evaluation-service/logs

Notification Backend Service

This service exposes APIs to create, fetch, and manage notifications.

Available Endpoints

POST /logs

Stores structured logs

POST /notifications

Creates a new notification

GET /notifications

Fetches notifications with pagination support

POST /maintenance/schedule

Computes the best maintenance plan for vehicles based on constraints
Vehicle Maintenance Scheduler

This module is responsible for selecting the most impactful maintenance tasks.

Key points:

Fetches data from external APIs (/depots and /vehicles)
Uses dynamic programming to maximize impact under time constraints
Falls back to sample data if API is unavailable
Logs all steps using the logging middleware
Outputs a JSON report of selected tasks
