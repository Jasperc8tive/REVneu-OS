-- Stage 4 persistence: agent runs and recommendations

DO $$ BEGIN
  CREATE TYPE "AgentRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCESS', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  period TEXT NOT NULL,
  status "AgentRunStatus" NOT NULL DEFAULT 'RUNNING',
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMP,
  duration_ms INTEGER,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  token_cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  error TEXT,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_agent_run_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recommendations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  agent_run_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  summary TEXT,
  findings JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_recommendation_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_recommendation_run FOREIGN KEY (agent_run_id) REFERENCES agent_runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_run_org_created_at ON agent_runs(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_run_org_agent_status ON agent_runs(organization_id, agent_id, status);
CREATE INDEX IF NOT EXISTS idx_recommendation_org_created_at ON recommendations(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_recommendation_org_agent ON recommendations(organization_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_run ON recommendations(agent_run_id);
