-- Stage 3 Data Layer: integrations, sync runs, and metric records

DO $$ BEGIN
  CREATE TYPE "IntegrationSource" AS ENUM (
    'GA4',
    'META_ADS',
    'GOOGLE_ADS',
    'HUBSPOT',
    'PAYSTACK',
    'STRIPE',
    'SHOPIFY',
    'FLUTTERWAVE',
    'TIKTOK_ADS',
    'SALESFORCE'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "IntegrationAuthType" AS ENUM ('OAUTH', 'API_KEY', 'WEBHOOK');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "IntegrationStatus" AS ENUM ('ACTIVE', 'NEEDS_REAUTH', 'ERROR', 'DISCONNECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SyncRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'DEAD_LETTER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MetricType" AS ENUM (
    'SPEND',
    'REVENUE',
    'SESSIONS',
    'CONVERSIONS',
    'CLICKS',
    'IMPRESSIONS',
    'CAC',
    'ROAS',
    'LTV'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS integration_connections (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  source "IntegrationSource" NOT NULL,
  auth_type "IntegrationAuthType" NOT NULL,
  display_name TEXT NOT NULL,
  encrypted_credentials TEXT NOT NULL,
  status "IntegrationStatus" NOT NULL DEFAULT 'ACTIVE',
  sync_interval_minutes INTEGER NOT NULL DEFAULT 60,
  last_sync_at TIMESTAMP,
  error_count INTEGER NOT NULL DEFAULT 0,
  health_score INTEGER NOT NULL DEFAULT 100,
  created_by_user_id TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_integration_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT uq_integration_display UNIQUE (organization_id, source, display_name)
);

CREATE TABLE IF NOT EXISTS integration_sync_runs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  integration_id TEXT NOT NULL,
  status "SyncRunStatus" NOT NULL DEFAULT 'QUEUED',
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMP,
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMP,
  records_ingested INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sync_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_sync_integration FOREIGN KEY (integration_id) REFERENCES integration_connections(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS metric_records (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  integration_id TEXT,
  source "IntegrationSource" NOT NULL,
  metric_type "MetricType" NOT NULL,
  dimension TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  recorded_at TIMESTAMP NOT NULL,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  raw_payload JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_metric_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_metric_integration FOREIGN KEY (integration_id) REFERENCES integration_connections(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_integration_org_source ON integration_connections(organization_id, source);
CREATE INDEX IF NOT EXISTS idx_integration_status ON integration_connections(status);
CREATE INDEX IF NOT EXISTS idx_sync_org_started_at ON integration_sync_runs(organization_id, started_at);
CREATE INDEX IF NOT EXISTS idx_sync_integration_status ON integration_sync_runs(integration_id, status);
CREATE INDEX IF NOT EXISTS idx_metric_org_source_type_recorded ON metric_records(organization_id, source, metric_type, recorded_at);
CREATE INDEX IF NOT EXISTS idx_metric_integration_recorded ON metric_records(integration_id, recorded_at);
