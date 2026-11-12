import { query, dbEnabled } from "./db.js";

export const devices = [
  { id: "LAB-ESP32-001", labId: "LAB-ROOM-01", name: "Chemistry Lab Sensor", status: "online", lastSeen: new Date().toISOString() },
  { id: "LAB-ESP32-002", labId: "LAB-ROOM-02", name: "Physics Lab Sensor", status: "online", lastSeen: new Date().toISOString() },
  { id: "LAB-ESP32-003", labId: "LAB-ROOM-01", name: "Biology Lab Sensor", status: "online", lastSeen: new Date().toISOString() }
];
export const readings = [];
export const alerts = [];
export const auditLogs = [];

export async function initializeStore() {
  if (!dbEnabled) return;
  await query("INSERT INTO laboratories(id,name,location) VALUES ('LAB-ROOM-01','Main Research Laboratory','Building A'),('LAB-ROOM-02','Physics Laboratory','Building B') ON CONFLICT(id) DO NOTHING");
  await query("INSERT INTO devices(id,lab_id,name,status) VALUES ('LAB-ESP32-001','LAB-ROOM-01','Chemistry Lab Sensor','offline'),('LAB-ESP32-002','LAB-ROOM-02','Physics Lab Sensor','offline'),('LAB-ESP32-003','LAB-ROOM-01','Biology Lab Sensor','offline') ON CONFLICT(id) DO NOTHING");
  const result = await query(`SELECT id, device_id AS "deviceId", lab_id AS "labId", temperature, humidity, recorded_at AS timestamp FROM sensor_readings ORDER BY recorded_at DESC LIMIT 1000`);
  readings.splice(0, readings.length, ...result.rows.map(r => ({...r, timestamp: new Date(r.timestamp).toISOString()})));
}

export async function saveReading(data) {
  const reading = { id: Date.now() + Math.random(), ...data };
  readings.unshift(reading);
  if (readings.length > 1000) readings.pop();

  const device = devices.find(d => d.id === data.deviceId);
  if (device) {
    device.status = "online";
    device.lastSeen = data.timestamp;
  }

  if (dbEnabled) {
    await query(
      `INSERT INTO sensor_readings(device_id, lab_id, temperature, humidity, recorded_at)
       VALUES($1,$2,$3,$4,$5)`,
      [data.deviceId, data.labId, data.temperature, data.humidity, data.timestamp]
    );
    await query(
      `INSERT INTO devices(id, lab_id, name, status, last_seen)
       VALUES($1,$2,$3,'online',$4)
       ON CONFLICT(id) DO UPDATE SET status='online', last_seen=EXCLUDED.last_seen`,
      [data.deviceId, data.labId, device?.name || data.deviceId, data.timestamp]
    );
  }

  if (data.temperature > 30 || data.temperature < 15 || data.humidity > 80 || data.humidity < 20) {
    const alert = {
      id: Date.now() + Math.random(),
      deviceId: data.deviceId,
      severity: data.temperature > 35 ? "critical" : "warning",
      message: `Unusual reading: ${data.temperature.toFixed(1)}°C, ${data.humidity.toFixed(1)}% RH`,
      createdAt: data.timestamp,
      acknowledged: false
    };
    alerts.unshift(alert);
    if (dbEnabled) {
      await query("INSERT INTO alerts(device_id,severity,message,created_at) VALUES($1,$2,$3,$4)",
        [alert.deviceId, alert.severity, alert.message, alert.createdAt]);
    }
  }
  return reading;
}
