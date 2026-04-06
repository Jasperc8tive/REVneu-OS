-- DropForeignKey
ALTER TABLE "agent_runs" DROP CONSTRAINT "fk_agent_run_organization";

-- DropForeignKey
ALTER TABLE "agent_schedules" DROP CONSTRAINT "fk_agent_schedule_organization";

-- DropForeignKey
ALTER TABLE "integration_connections" DROP CONSTRAINT "fk_integration_organization";

-- DropForeignKey
ALTER TABLE "integration_sync_runs" DROP CONSTRAINT "fk_sync_integration";

-- DropForeignKey
ALTER TABLE "integration_sync_runs" DROP CONSTRAINT "fk_sync_organization";

-- DropForeignKey
ALTER TABLE "metric_records" DROP CONSTRAINT "fk_metric_integration";

-- DropForeignKey
ALTER TABLE "metric_records" DROP CONSTRAINT "fk_metric_organization";

-- DropForeignKey
ALTER TABLE "recommendations" DROP CONSTRAINT "fk_recommendation_organization";

-- DropForeignKey
ALTER TABLE "recommendations" DROP CONSTRAINT "fk_recommendation_run";

-- AlterTable
ALTER TABLE "agent_runs" ALTER COLUMN "started_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "finished_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "agent_schedules" ALTER COLUMN "last_triggered_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "integration_connections" ALTER COLUMN "last_sync_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "integration_sync_runs" ALTER COLUMN "started_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "finished_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "next_retry_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "metric_records" ALTER COLUMN "recorded_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "period_start" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "period_end" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "recommendations" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_sync_runs" ADD CONSTRAINT "integration_sync_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_sync_runs" ADD CONSTRAINT "integration_sync_runs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "integration_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_records" ADD CONSTRAINT "metric_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_records" ADD CONSTRAINT "metric_records_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "integration_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_agent_run_id_fkey" FOREIGN KEY ("agent_run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_schedules" ADD CONSTRAINT "agent_schedules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "idx_agent_run_org_agent_status" RENAME TO "agent_runs_organization_id_agent_id_status_idx";

-- RenameIndex
ALTER INDEX "idx_agent_run_org_created_at" RENAME TO "agent_runs_organization_id_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_agent_schedule_enabled_cadence" RENAME TO "agent_schedules_is_enabled_cadence_minutes_idx";

-- RenameIndex
ALTER INDEX "idx_integration_org_source" RENAME TO "integration_connections_organization_id_source_idx";

-- RenameIndex
ALTER INDEX "idx_integration_status" RENAME TO "integration_connections_status_idx";

-- RenameIndex
ALTER INDEX "uq_integration_display" RENAME TO "integration_connections_organization_id_source_display_name_key";

-- RenameIndex
ALTER INDEX "idx_sync_integration_status" RENAME TO "integration_sync_runs_integration_id_status_idx";

-- RenameIndex
ALTER INDEX "idx_sync_org_started_at" RENAME TO "integration_sync_runs_organization_id_started_at_idx";

-- RenameIndex
ALTER INDEX "idx_metric_integration_recorded" RENAME TO "metric_records_integration_id_recorded_at_idx";

-- RenameIndex
ALTER INDEX "idx_metric_org_source_type_recorded" RENAME TO "metric_records_organization_id_source_metric_type_recorded__idx";

-- RenameIndex
ALTER INDEX "idx_recommendation_org_agent" RENAME TO "recommendations_organization_id_agent_id_idx";

-- RenameIndex
ALTER INDEX "idx_recommendation_org_created_at" RENAME TO "recommendations_organization_id_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_recommendation_run" RENAME TO "recommendations_agent_run_id_idx";
