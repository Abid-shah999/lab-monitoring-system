from fastapi import FastAPI
from pydantic import BaseModel, Field
from datetime import datetime, timezone

app = FastAPI(title="LabSense ML Service", version="1.0.0")

class Reading(BaseModel):
    temperature: float = Field(ge=-50, le=100)
    humidity: float = Field(ge=0, le=100)

@app.get("/health")
def health():
    return {"status": "ok", "service": "labsense-ml"}

@app.post("/predict")
def predict(reading: Reading):
    # Baseline rule-based anomaly score for the demo.
    # Replace with a trained model after collecting representative lab data.
    temp_score = max(0.0, abs(reading.temperature - 23.0) - 4.0) / 15.0
    humidity_score = max(0.0, abs(reading.humidity - 55.0) - 20.0) / 45.0
    score = round(min(1.0, max(temp_score, humidity_score)), 3)
    is_anomaly = score >= 0.35
    reasons = []
    if reading.temperature < 15 or reading.temperature > 30:
        reasons.append("Temperature outside demo range (15–30 °C)")
    if reading.humidity < 20 or reading.humidity > 80:
        reasons.append("Humidity outside demo range (20–80 %)")
    if not reasons:
        reasons.append("No rule-based threshold breach detected")
    return {
        "is_anomaly": is_anomaly,
        "score": score,
        "reasons": reasons,
        "analyzed_at": datetime.now(timezone.utc).isoformat(),
        "model": "demo-rule-based-v1"
    }
