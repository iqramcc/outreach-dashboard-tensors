-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('SCHOOL', 'TUITION_CENTRE', 'OTHER');

-- CreateEnum
CREATE TYPE "RegionCategory" AS ENUM ('KERALA', 'TAMIL_NADU', 'MIDDLE_EAST', 'OTHER_STATE');

-- CreateEnum
CREATE TYPE "ListType" AS ENUM ('MASS_CALL', 'CONNECTED', 'OFFLINE_OUTREACH');

-- CreateEnum
CREATE TYPE "ColumnType" AS ENUM ('TEXT', 'LONGTEXT', 'NUMBER', 'PHONE', 'EMAIL', 'SELECT', 'DATE', 'CHECKBOX');

-- CreateEnum
CREATE TYPE "OutreachChannel" AS ENUM ('CALL', 'WHATSAPP', 'EMAIL', 'VISIT', 'OTHER');

-- CreateEnum
CREATE TYPE "ImportMode" AS ENUM ('TAB_PER_SHEET', 'MERGE_ALL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sheet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "primaryPoc" TEXT,
    "nameKey" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL DEFAULT 'SCHOOL',
    "schoolType" TEXT,
    "financeType" TEXT,
    "studentStrength" TEXT,
    "regionCategory" "RegionCategory" NOT NULL DEFAULT 'KERALA',
    "district" TEXT,
    "state" TEXT,
    "listType" "ListType" NOT NULL DEFAULT 'MASS_CALL',
    "connection" TEXT,
    "pocName" TEXT,
    "pocRole" TEXT,
    "contact" TEXT,
    "contactKey" TEXT,
    "email" TEXT,
    "address" TEXT,
    "website" TEXT,
    "statusId" TEXT,
    "assignedToId" TEXT,
    "nextFollowUpAt" TIMESTAMP(3),
    "lastContactedAt" TIMESTAMP(3),
    "registeredStudents" INTEGER,
    "remarks" TEXT,
    "extra" JSONB NOT NULL DEFAULT '{}',
    "cellColors" JSONB NOT NULL DEFAULT '{}',
    "importBatchId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachStatus" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hex" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isPositive" BOOLEAN NOT NULL DEFAULT false,
    "isContacted" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutreachStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColumnDef" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "ColumnType" NOT NULL DEFAULT 'TEXT',
    "options" JSONB,
    "isCore" BOOLEAN NOT NULL DEFAULT false,
    "sheetId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "width" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ColumnDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColumnPref" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "columnDefId" TEXT NOT NULL,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER,

    CONSTRAINT "ColumnPref_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachLog" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT,
    "channel" "OutreachChannel" NOT NULL DEFAULT 'CALL',
    "outcome" TEXT,
    "note" TEXT,
    "nextFollowUpAt" TIMESTAMP(3),
    "fromStatusName" TEXT,
    "toStatusName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mode" "ImportMode" NOT NULL,
    "createdById" TEXT,
    "rowsCreated" INTEGER NOT NULL DEFAULT 0,
    "rowsUpdated" INTEGER NOT NULL DEFAULT 0,
    "rowsSkipped" INTEGER NOT NULL DEFAULT 0,
    "sheetNames" JSONB NOT NULL DEFAULT '[]',
    "isUndone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Sheet_isArchived_order_idx" ON "Sheet"("isArchived", "order");

-- CreateIndex
CREATE INDEX "School_nameKey_idx" ON "School"("nameKey");

-- CreateIndex
CREATE INDEX "School_contactKey_idx" ON "School"("contactKey");

-- CreateIndex
CREATE INDEX "School_sheetId_idx" ON "School"("sheetId");

-- CreateIndex
CREATE INDEX "School_regionCategory_district_idx" ON "School"("regionCategory", "district");

-- CreateIndex
CREATE INDEX "School_listType_idx" ON "School"("listType");

-- CreateIndex
CREATE INDEX "School_statusId_idx" ON "School"("statusId");

-- CreateIndex
CREATE INDEX "School_assignedToId_idx" ON "School"("assignedToId");

-- CreateIndex
CREATE INDEX "School_nextFollowUpAt_idx" ON "School"("nextFollowUpAt");

-- CreateIndex
CREATE INDEX "School_importBatchId_idx" ON "School"("importBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "OutreachStatus_name_key" ON "OutreachStatus"("name");

-- CreateIndex
CREATE INDEX "OutreachStatus_order_idx" ON "OutreachStatus"("order");

-- CreateIndex
CREATE INDEX "ColumnDef_order_idx" ON "ColumnDef"("order");

-- CreateIndex
CREATE UNIQUE INDEX "ColumnDef_sheetId_key_key" ON "ColumnDef"("sheetId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ColumnPref_userId_columnDefId_key" ON "ColumnPref"("userId", "columnDefId");

-- CreateIndex
CREATE INDEX "OutreachLog_schoolId_createdAt_idx" ON "OutreachLog"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "OutreachLog_userId_createdAt_idx" ON "OutreachLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "OutreachLog_createdAt_idx" ON "OutreachLog"("createdAt");

-- CreateIndex
CREATE INDEX "ImportBatch_createdAt_idx" ON "ImportBatch"("createdAt");

-- AddForeignKey
ALTER TABLE "Sheet" ADD CONSTRAINT "Sheet_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "Sheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "OutreachStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColumnDef" ADD CONSTRAINT "ColumnDef_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "Sheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColumnPref" ADD CONSTRAINT "ColumnPref_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColumnPref" ADD CONSTRAINT "ColumnPref_columnDefId_fkey" FOREIGN KEY ("columnDefId") REFERENCES "ColumnDef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachLog" ADD CONSTRAINT "OutreachLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachLog" ADD CONSTRAINT "OutreachLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
