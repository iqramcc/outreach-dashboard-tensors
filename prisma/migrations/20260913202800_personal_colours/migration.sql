-- CreateTable
CREATE TABLE "UserStatusColor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "statusId" TEXT NOT NULL,
    "hex" TEXT NOT NULL,

    CONSTRAINT "UserStatusColor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalTag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hex" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonalTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolPersonalTag" (
    "schoolId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "SchoolPersonalTag_pkey" PRIMARY KEY ("schoolId","tagId")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserStatusColor_userId_statusId_key" ON "UserStatusColor"("userId", "statusId");

-- CreateIndex
CREATE INDEX "PersonalTag_userId_order_idx" ON "PersonalTag"("userId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalTag_userId_name_key" ON "PersonalTag"("userId", "name");

-- CreateIndex
CREATE INDEX "SchoolPersonalTag_tagId_idx" ON "SchoolPersonalTag"("tagId");

-- AddForeignKey
ALTER TABLE "UserStatusColor" ADD CONSTRAINT "UserStatusColor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStatusColor" ADD CONSTRAINT "UserStatusColor_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "OutreachStatus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalTag" ADD CONSTRAINT "PersonalTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolPersonalTag" ADD CONSTRAINT "SchoolPersonalTag_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolPersonalTag" ADD CONSTRAINT "SchoolPersonalTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "PersonalTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
