-- AlterEnum
ALTER TYPE "UserType" ADD VALUE 'admin';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;
