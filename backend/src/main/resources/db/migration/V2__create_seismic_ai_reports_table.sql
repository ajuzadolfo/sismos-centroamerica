CREATE TABLE IF NOT EXISTS seismic_ai_reports (
    event_id VARCHAR(64) PRIMARY KEY REFERENCES seismic_events(id) ON DELETE CASCADE,
    model_used VARCHAR(64) NOT NULL,
    executive_summary TEXT NOT NULL,
    tectonic_context TEXT NOT NULL,
    tsunami_risk TEXT NOT NULL,
    safety_recommendations TEXT NOT NULL,
    estimated_peak_intensity VARCHAR(64),
    generated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_seismic_ai_reports_generated ON seismic_ai_reports(generated_at DESC);
