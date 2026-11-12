# Lab Monitoring System — Platform-Only Dummy Data Edition

A full-stack laboratory temperature/humidity monitoring starter using only:
- VS Code for development
- GitHub for source control
- Vercel for the React frontend
- Render for the Node.js backend and Python ML API
- Neon PostgreSQL for persistent data

**No Docker, Docker Compose, Mosquitto, or external MQTT broker is required for this dummy-data edition.**

## Important MQTT limitation

The current dummy-data build sends simulated sensor readings to the Node.js API over HTTP, then streams updates to React with Socket.IO. This makes the complete website usable without hardware or an MQTT broker.

A real ESP32 normally publishes MQTT messages to an MQTT broker. Render, Vercel, and Neon do not provide a managed MQTT broker. Since this version is restricted to those platforms only, actual MQTT broker connectivity is intentionally not included. When hardware is acquired, either:
1. add a separately hosted MQTT broker, or
2. keep the platform-only restriction and have ESP32 send authenticated HTTPS telemetry to the Render backend instead of MQTT.

Do not describe the HTTP simulator as MQTT; they are different protocols.

## Requirements
- Node.js 20+
- Python 3.10+
- Git

## Local setup in VS Code

### 1. Backend
```bash
cd backend
npm install
```
Copy `backend/.env.example` to `backend/.env`. Keep `DEMO_SIMULATOR=true` and `USE_DATABASE=false` for the first local run.

```bash
npm run dev
```
API: http://localhost:5000

### 2. Frontend
Open a second terminal:
```bash
cd frontend
npm install
```
Copy `frontend/.env.example` to `frontend/.env`, then:
```bash
npm run dev
```
Open http://localhost:5173

### 3. Python ML service (optional)
Open a third terminal:
```bash
cd ml-service
python -m venv .venv
```
Windows PowerShell:
```powershell
.venv\Scripts\Activate.ps1
```
macOS/Linux:
```bash
source .venv/bin/activate
```
Then:
```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Demo accounts
Password for all accounts: `Password123!`
- Admin: `admin@lab.local`
- Lab assistant: `assistant@lab.local`
- User: `user@lab.local`

These accounts are hard-coded demo accounts. Do not use them in production.

## Neon PostgreSQL
1. Create a Neon project and database.
2. Run `database/schema.sql` in the Neon SQL Editor.
3. Copy the Neon connection string.
4. Set `DATABASE_URL` in `backend/.env`.
5. Set `USE_DATABASE=true`.
6. Restart the backend.

The backend uses in-memory demo data when `USE_DATABASE=false`; this data resets when the backend restarts. For production, add database-backed user management and seed real users securely; current login accounts are demo-only.

## GitHub
From the project root:
```bash
git init
git add .
git commit -m "Initial LabSense project"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/lab-monitoring-system.git
git push -u origin main
```

## Deploy backend and ML service on Render

### Backend Web Service
- Connect the GitHub repository.
- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`
- Environment variables:
  - `JWT_SECRET`: long random secret
  - `FRONTEND_ORIGIN`: your deployed Vercel frontend URL
  - `DATABASE_URL`: Neon connection string
  - `USE_DATABASE`: `true`
  - `DEMO_SIMULATOR`: `true` for simulated readings
  - `ML_API_URL`: deployed ML service URL

### ML Web Service
- Root Directory: `ml-service`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### Vercel frontend
- Import the GitHub repository into Vercel.
- Root Directory: `frontend`
- Framework preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment variable:
  - `VITE_API_URL`: deployed Render backend URL

After deployment, update the backend `FRONTEND_ORIGIN` to the exact Vercel site origin and redeploy/restart the backend.

## Included
- React dashboard with Admin, Lab Assistant and User roles
- Live charts using Socket.IO
- Built-in simulated ESP32-style telemetry every 5 seconds
- Node.js Express API
- Optional Neon PostgreSQL persistence
- Python FastAPI anomaly scoring endpoint
- CSV export
- Basic JWT authentication and role checks
- Helmet and CORS configuration

## Production security gaps to address before real use
This is a learning starter, not a production-secure laboratory system. The demo login accounts are hard-coded; audit logs and alerts are currently in memory; the demo telemetry endpoint is unauthenticated; user/device management is illustrative. Before using real lab data, implement persistent user/device provisioning, per-device credentials or signed telemetry, rate limiting, stronger validation, password reset, secure role administration, persistent audit logs, backups, and a security review.

Render free services may sleep when idle and free-tier policies can change. Verify current platform limits before deployment.
