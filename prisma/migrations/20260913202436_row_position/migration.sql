-- AlterTable
ALTER TABLE "School" ADD COLUMN     "position" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "School_sheetId_position_idx" ON "School"("sheetId", "position");
