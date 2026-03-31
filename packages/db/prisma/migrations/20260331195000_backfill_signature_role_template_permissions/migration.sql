-- Backfill signature permission keys into existing role templates that predate
-- the e-signature center permission catalog expansion.
INSERT INTO "OrganizationRoleTemplatePermission" (
    "id",
    "organizationId",
    "organizationRoleTemplateId",
    "permissionKey",
    "createdAt",
    "updatedAt"
)
SELECT
    'sigperm_' || md5(template."organizationId" || ':' || template."id" || ':' || mapped."permissionKey"),
    template."organizationId",
    template."id",
    mapped."permissionKey",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "OrganizationRoleTemplate" AS template
JOIN (
    VALUES
        ('owner', 'signatures:view'),
        ('owner', 'signatures:manage'),
        ('owner', 'signatures:template_manage'),
        ('owner', 'signatures:report_view'),
        ('owner', 'signatures:report_export'),
        ('office_admin', 'signatures:view'),
        ('office_admin', 'signatures:manage'),
        ('office_admin', 'signatures:template_manage'),
        ('office_admin', 'signatures:report_view'),
        ('office_admin', 'signatures:report_export'),
        ('office_manager', 'signatures:view'),
        ('office_manager', 'signatures:manage'),
        ('office_manager', 'signatures:template_manage'),
        ('office_manager', 'signatures:report_view'),
        ('office_manager', 'signatures:report_export'),
        ('office_user', 'signatures:view'),
        ('accountant', 'signatures:view'),
        ('accountant', 'signatures:manage'),
        ('accountant', 'signatures:report_view'),
        ('accountant', 'signatures:report_export'),
        ('human_resources', 'signatures:view'),
        ('human_resources', 'signatures:manage'),
        ('human_resources', 'signatures:report_view'),
        ('human_resources', 'signatures:report_export'),
        ('team_lead', 'signatures:view'),
        ('agent', 'signatures:view')
) AS mapped("role", "permissionKey")
  ON template."role" = mapped."role"::"UserRole"
LEFT JOIN "OrganizationRoleTemplatePermission" AS existing
  ON existing."organizationRoleTemplateId" = template."id"
 AND existing."permissionKey" = mapped."permissionKey"
WHERE existing."id" IS NULL;
