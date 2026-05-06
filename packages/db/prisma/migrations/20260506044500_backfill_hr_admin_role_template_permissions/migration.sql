-- Backfill HR and Admin Office permission keys into existing role templates
-- that predate the HR/Admin Office workspace launch.
INSERT INTO "OrganizationRoleTemplatePermission" (
    "id",
    "organizationId",
    "organizationRoleTemplateId",
    "permissionKey",
    "createdAt",
    "updatedAt"
)
SELECT
    'hradminperm_' || md5(template."organizationId" || ':' || template."id" || ':' || mapped."permissionKey"),
    template."organizationId",
    template."id",
    mapped."permissionKey",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "OrganizationRoleTemplate" AS template
JOIN (
    VALUES
        ('owner', 'hr:view'),
        ('owner', 'hr:manage'),
        ('owner', 'hr:templates_manage'),
        ('owner', 'hr:offboarding_manage'),
        ('owner', 'admin_office:view'),
        ('owner', 'admin_office:manage'),
        ('office_admin', 'hr:view'),
        ('office_admin', 'hr:manage'),
        ('office_admin', 'hr:templates_manage'),
        ('office_admin', 'hr:offboarding_manage'),
        ('office_admin', 'admin_office:view'),
        ('office_admin', 'admin_office:manage'),
        ('human_resources', 'hr:view'),
        ('human_resources', 'hr:manage'),
        ('human_resources', 'hr:templates_manage'),
        ('human_resources', 'hr:offboarding_manage'),
        ('human_resources', 'admin_office:view'),
        ('human_resources', 'admin_office:manage'),
        ('office_manager', 'hr:view'),
        ('office_manager', 'admin_office:view'),
        ('accountant', 'hr:view'),
        ('accountant', 'admin_office:view')
) AS mapped("role", "permissionKey")
  ON template."role" = mapped."role"::"UserRole"
LEFT JOIN "OrganizationRoleTemplatePermission" AS existing
  ON existing."organizationRoleTemplateId" = template."id"
 AND existing."permissionKey" = mapped."permissionKey"
WHERE existing."id" IS NULL;
