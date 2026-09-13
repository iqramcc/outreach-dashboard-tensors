-- CreateEnum
CREATE TYPE "CampaignEntryStatus" AS ENUM ('NEW', 'SENT');

-- CreateTable
CREATE TABLE "CampaignList" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "requiredFields" JSONB NOT NULL DEFAULT '[]',
    "optionalFields" JSONB NOT NULL DEFAULT '[]',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignEntry" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "status" "CampaignEntryStatus" NOT NULL DEFAULT 'NEW',
    "sentAt" TIMESTAMP(3),
    "addedById" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CampaignList_name_key" ON "CampaignList"("name");

-- CreateIndex
CREATE INDEX "CampaignList_isArchived_order_idx" ON "CampaignList"("isArchived", "order");

-- CreateIndex
CREATE INDEX "CampaignEntry_listId_status_idx" ON "CampaignEntry"("listId", "status");

-- CreateIndex
CREATE INDEX "CampaignEntry_schoolId_idx" ON "CampaignEntry"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignEntry_listId_schoolId_key" ON "CampaignEntry"("listId", "schoolId");

-- AddForeignKey
ALTER TABLE "CampaignEntry" ADD CONSTRAINT "CampaignEntry_listId_fkey" FOREIGN KEY ("listId") REFERENCES "CampaignList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignEntry" ADD CONSTRAINT "CampaignEntry_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignEntry" ADD CONSTRAINT "CampaignEntry_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
