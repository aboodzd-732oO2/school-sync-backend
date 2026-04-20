-- AlterTable: Department — إضافة color/icon
ALTER TABLE "Department" ADD COLUMN "color" TEXT NOT NULL DEFAULT '#64748b',
ADD COLUMN "icon" TEXT NOT NULL DEFAULT '📦';

-- AlterTable: Request — تحويل priority من enum إلى text (يحافظ على القيم)
ALTER TABLE "Request" ALTER COLUMN "priority" TYPE TEXT USING "priority"::TEXT;

-- DropEnum: الآن آمن لأن لا يوجد عمود يستخدمه
DROP TYPE "Priority";

-- CreateTable: Unit
CREATE TABLE "Unit" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Priority (reference table)
CREATE TABLE "Priority" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "labelAr" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#64748b',
    CONSTRAINT "Priority_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Unit_name_key" ON "Unit"("name");
CREATE UNIQUE INDEX "Priority_key_key" ON "Priority"("key");
