-- CreateTable
CREATE TABLE "InstitutionType" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "labelAr" TEXT NOT NULL,

    CONSTRAINT "InstitutionType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentItem" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "labelAr" TEXT NOT NULL,
    "defaultUnit" TEXT NOT NULL DEFAULT 'قطعة',
    "departmentId" INTEGER NOT NULL,

    CONSTRAINT "DepartmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionType_key_key" ON "InstitutionType"("key");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentItem_key_departmentId_key" ON "DepartmentItem"("key", "departmentId");

-- AddForeignKey
ALTER TABLE "DepartmentItem" ADD CONSTRAINT "DepartmentItem_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
