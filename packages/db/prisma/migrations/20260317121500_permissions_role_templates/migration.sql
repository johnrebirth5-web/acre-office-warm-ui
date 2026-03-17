-- CreateEnum
CREATE TYPE "ContactVisibility" AS ENUM ('organization_shared', 'private');

-- CreateEnum
CREATE TYPE "PermissionOverrideEffect" AS ENUM ('allow', 'deny');

-- AlterEnum
ALTER TYPE "LibraryDocumentVisibility" ADD VALUE 'private';

-- AlterTable
ALTER TABLE "Client"
ADD COLUMN "visibility" "ContactVisibility" NOT NULL DEFAULT 'organization_shared';

-- AlterTable
ALTER TABLE "LibraryFolder"
ADD COLUMN "ownerMembershipId" TEXT,
ADD COLUMN "visibility" "LibraryDocumentVisibility" NOT NULL DEFAULT 'company_wide';

-- AlterTable
ALTER TABLE "LibraryDocument"
ADD COLUMN "ownerMembershipId" TEXT;

-- CreateTable
CREATE TABLE "OrganizationRoleTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "updatedByMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationRoleTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationRoleTemplatePermission" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "organizationRoleTemplateId" TEXT NOT NULL,
    "permissionKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationRoleTemplatePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipPermissionOverride" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "permissionKey" TEXT NOT NULL,
    "effect" "PermissionOverrideEffect" NOT NULL,
    "createdByMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MembershipPermissionOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizationRoleTemplate_organizationId_updatedAt_idx" ON "OrganizationRoleTemplate"("organizationId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationRoleTemplate_organizationId_role_key" ON "OrganizationRoleTemplate"("organizationId", "role");

-- CreateIndex
CREATE INDEX "OrganizationRoleTemplatePermission_organizationId_permissio_idx" ON "OrganizationRoleTemplatePermission"("organizationId", "permissionKey");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationRoleTemplatePermission_organizationRoleTemplate_key"
ON "OrganizationRoleTemplatePermission"("organizationRoleTemplateId", "permissionKey");

-- CreateIndex
CREATE INDEX "MembershipPermissionOverride_organizationId_permissionKey_idx" ON "MembershipPermissionOverride"("organizationId", "permissionKey");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipPermissionOverride_membershipId_permissionKey_key"
ON "MembershipPermissionOverride"("membershipId", "permissionKey");

-- CreateIndex
CREATE INDEX "Client_organizationId_visibility_idx" ON "Client"("organizationId", "visibility");

-- CreateIndex
CREATE INDEX "LibraryFolder_organizationId_visibility_idx" ON "LibraryFolder"("organizationId", "visibility");

-- AddForeignKey
ALTER TABLE "OrganizationRoleTemplate"
ADD CONSTRAINT "OrganizationRoleTemplate_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationRoleTemplate"
ADD CONSTRAINT "OrganizationRoleTemplate_updatedByMembershipId_fkey"
FOREIGN KEY ("updatedByMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationRoleTemplatePermission"
ADD CONSTRAINT "OrganizationRoleTemplatePermission_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationRoleTemplatePermission"
ADD CONSTRAINT "OrganizationRoleTemplatePermission_organizationRoleTemplat_fkey"
FOREIGN KEY ("organizationRoleTemplateId") REFERENCES "OrganizationRoleTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipPermissionOverride"
ADD CONSTRAINT "MembershipPermissionOverride_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipPermissionOverride"
ADD CONSTRAINT "MembershipPermissionOverride_membershipId_fkey"
FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipPermissionOverride"
ADD CONSTRAINT "MembershipPermissionOverride_createdByMembershipId_fkey"
FOREIGN KEY ("createdByMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryFolder"
ADD CONSTRAINT "LibraryFolder_ownerMembershipId_fkey"
FOREIGN KEY ("ownerMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryDocument"
ADD CONSTRAINT "LibraryDocument_ownerMembershipId_fkey"
FOREIGN KEY ("ownerMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
