import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import { Server } from "socket.io";
import { loginUser, authenticate, allowRoles } from "./auth.js";
import { devices, readings, alerts, auditLogs, saveReading, initializeStore } from "./store.js";


const app = express();
const server = http.createServer(app);
const origin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
const io = new Server(server, { cors: { origin, methods: ["GET", "POST"] } });

app.use(helmet());
app.use(cors({ origin }));
app.use(express.json({ limit: "20kb" }));

app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "lab-monitoring-api" }));

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: "Email and password are required" });
  const result = loginUser(email, password);
  if (!result) return res.status(401).json({ message: "Incorrect email or password" });
  auditLogs.unshift({ id: Date.now(), user: result.user.email, action: "LOGIN", createdAt: new Date().toISOString() });
  res.json(result);
});

app.get("/api/me", authenticate, (req, res) => res.json({ user: req.user }));

app.get("/api/dashboard", authenticate, (req, res) => {
  const visibleDevices = req.user.role === "user" ? devices.slice(0, 2) : devices;
  const visibleReadings = req.user.role === "user" ? readings.filter(r => r.labId === "LAB-ROOM-01") : readings;
  res.json({
    stats: {
      devices: visibleDevices.length,
      online: visibleDevices.filter(d => d.status === "online").length,
      readings: visibleReadings.length,
      activeAlerts: alerts.filter(a => !a.acknowledged).length
    },
    devices: visibleDevices,
    readings: visibleReadings.slice(0, 80),
    alerts: alerts.slice(0, 20)
  });
});

app.get("/api/readings", authenticate, (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  res.json(readings.slice(0, limit));
});

app.post("/api/telemetry", (req, res) => {
  // Demo ingestion endpoint. In production, protect this with device credentials or disable it.
  const data = req.body || {};
  if (!data || typeof data.deviceId !== "string" ||
      !Number.isFinite(Number(data.temperature)) || !Number.isFinite(Number(data.humidity)) ||
      Number(data.temperature) < -50 || Number(data.temperature) > 100 ||
      Number(data.humidity) < 0 || Number(data.humidity) > 100) return res.status(400).json({ message: "Invalid telemetry payload" });
  saveReading({
    deviceId: data.deviceId,
    labId: data.labId || "LAB-ROOM-01",
    temperature: Number(data.temperature),
    humidity: Number(data.humidity),
    timestamp: data.timestamp || new Date().toISOString()
  }).then(reading => {
    io.emit("sensor:reading", reading);
    res.status(201).json({ received: true, reading });
  }).catch(() => res.status(500).json({ message: "Could not store reading" }));
});

app.get("/api/devices", authenticate, (_req, res) => res.json(devices));
app.get("/api/alerts", authenticate, (_req, res) => res.json(alerts));
app.post("/api/alerts/:id/acknowledge", authenticate, allowRoles("admin", "assistant"), (req, res) => {
  const alert = alerts.find(a => String(a.id) === req.params.id);
  if (!alert) return res.status(404).json({ message: "Alert not found" });
  alert.acknowledged = true;
  res.json({ success: true, alert });
});
app.get("/api/audit-logs", authenticate, allowRoles("admin"), (_req, res) => res.json(auditLogs.slice(0, 100)));

app.post("/api/ml/analyze", authenticate, async (req, res) => {
  try {
    const response = await fetch(`${process.env.ML_API_URL || "http://localhost:8000"}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body)
    });
    const result = await response.json();
    res.status(response.status).json(result);
  } catch {
    res.status(503).json({ message: "ML service is unavailable" });
  }
});

if (process.env.DEMO_SIMULATOR !== "false") {
  let tick = 0;
  setInterval(async () => {
    tick++;
    for (const device of devices) {
      const base = device.id.endsWith("001") ? 23 : device.id.endsWith("002") ? 26 : 22;
      const spike = tick % 37 === 0 && device.id.endsWith("002");
      const data = {
        deviceId: device.id,
        labId: device.labId,
        temperature: Number((base + Math.sin(tick / 4) * 1.7 + (Math.random() - 0.5) * 0.8 + (spike ? 13 : 0)).toFixed(2)),
        humidity: Number((55 + Math.cos(tick / 5) * 7 + (Math.random() - 0.5) * 2).toFixed(2)),
        timestamp: new Date().toISOString()
      };
      try {
        const reading = await saveReading(data);
        io.emit("sensor:reading", reading);
      } catch (error) {
        console.error("Demo simulator error:", error.message);
      }
    }
  }, 5000);
}

const port = Number(process.env.PORT) || 5000;
initializeStore().then(() => server.listen(port, () => console.log(`API running on http://localhost:${port}`))).catch(error => { console.error("Database initialization failed:", error.message); process.exit(1); });
