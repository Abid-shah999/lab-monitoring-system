CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(30) NOT NULL CHECK (role IN ('admin','assistant','user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS laboratories (
  id VARCHAR(60) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  location VARCHAR(180),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO laboratories(id, name, location) VALUES
  ('LAB-ROOM-01', 'Main Research Laboratory', 'Building A'),
  ('LAB-ROOM-02', 'Physics Laboratory', 'Building B')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS devices (
  id VARCHAR(80) PRIMARY KEY,
  lab_id VARCHAR(60) REFERENCES laboratories(id),
  name VARCHAR(120) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'offline',
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sensor_readings (
  id BIGSERIAL PRIMARY KEY,
  device_id VARCHAR(80) NOT NULL REFERENCES devices(id),
  lab_id VARCHAR(60) REFERENCES laboratories(id),
  temperature DOUBLE PRECISION NOT NULL,
  humidity DOUBLE PRECISION NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_readings_recorded_at ON sensor_readings(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_readings_device_time ON sensor_readings(device_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS alerts (
  id BIGSERIAL PRIMARY KEY,
  device_id VARCHAR(80),
  severity VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_email VARCHAR(180),
  action VARCHAR(180) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
