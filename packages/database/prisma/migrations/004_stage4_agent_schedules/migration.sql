-- Stage 4 scheduler state persistence

CREATE TABLE IF NOT EXISTS agent_schedules (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL UNIQUE,
  cadence_minutes INTEGER NOT NULL DEFAULT 60,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMP,
  last_run_status "AgentRunStatus",
  last_error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_agent_schedule_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_schedule_enabled_cadence ON agent_schedules(is_enabled, cadence_minutes);
