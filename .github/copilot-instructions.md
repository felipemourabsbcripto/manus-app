# Copilot Instructions for Manus App

## Project Overview
Manus App is a workforce management application combining a React frontend and Node.js backend in a single repository.
- **Frontend**: React (Vite), React Router, Lucide Icons, Recharts.
- **Backend**: Node.js, Express, `better-sqlite3` (SQLite).
- **Infrastrucutre**: Docker, AWS Lightsail (via `deploy-aws.sh`) or AWS VPC/EC2 (via `aws/` CloudFormation).

## Architecture & Code Organization
- **Monorepo Structure**:
  - `src/`: React Frontend application.
  - `server/`: Node.js Backend API.
  - `aws/` & `infrastructure/`: IaC definitions (CloudFormation) and scripts.
- **Database**:
  - Uses **SQLite** (`escala.db`) via `better-sqlite3` strictly. 
  - Schemas defined in `server/database.js` (raw SQL).
  - *Note: `infrastructure/README.md` mentions PostgreSQL, but the application code (`server/database.js`) is hardcoded for SQLite.*
- **API**:
  - Routes defined primarily in `server/index.js` (monolithic route file).
  - External modules: `server/whatsapp.js` (messaging), `server/localizacao.js` (geo).
  - Base URL resolved dynamically in `src/config.js` (`/api` in production, calculated host in sandbox/dev).

## Development Workflow
- **Running Locally**: Requires two concurrent processes:
  1. Backend: `npm run server` (runs `server/index.js` on port 3000/default).
  2. Frontend: `npm run dev` (Vite dev server).
- **Deployment**:
  - **Script**: `deploy-aws.sh` zips the repo and deploys to a single AWS Lightsail instance running Docker.
  - **Docker**: `Dockerfile` sets up the containerized environment.

## Coding Conventions
- **Authentication**:
  - Custom implementation in `server/index.js` (`/api/auth/login`).
  - Google Social Login via `google-auth-library`.
  - Frontend auth state managed in `src/contexts/AuthContext.jsx`.
  - *Current Security*: Uses a placeholder "fake-jwt-token-for-now" in responses; rely on DB lookups.
- **Frontend Logic**:
  - Use `fetch` for API calls (no global Axios instance found).
  - React Router for navigation (`src/App.jsx`).
  - Dates handled with `date-fns`.
- **Database Access**:
  - Use synchronous `db.prepare(...).get()` or `run()` methods from `better-sqlite3`.
  - Do not use async/await for DB operations (SQLite driver is synchronous).

## Critical Implementation Details
- **Environment Handling**:
  - Check `src/config.js` for environment detection logic which switches API endpoints based on hostname (localhost vs AWS vs Sandbox).
- **Service Boundaries**:
  - `server/index.js` contains the bulk of business logic. Refactor to separate controllers if expanding.
  - The `infrastructure/` folder contains sophisticated AWS setups (ALB, ASG, RDS) that appear separate from the current simple `deploy-aws.sh` workflow. Verify which target is intended before modifying infra.
