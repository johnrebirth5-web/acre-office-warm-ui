-- Backfill Listing Studio permission keys into existing role templates that
-- predate the Listing Studio workspace launch.
INSERT INTO "OrganizationRoleTemplatePermission" (
    "id",
    "organizationId",
    "organizationRoleTemplateId",
    "permissionKey",
    "createdAt",
    "updatedAt"
)
SELECT
    'lstperm_' || md5(template."organizationId" || ':' || template."id" || ':' || mapped."permissionKey"),
    template."organizationId",
    template."id",
    mapped."permissionKey",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "OrganizationRoleTemplate" AS template
JOIN (
    VALUES
        ('owner', 'listing_studio:view'),
        ('owner', 'listing_studio:create'),
        ('owner', 'listing_studio:edit'),
        ('owner', 'listing_studio:share'),
        ('office_admin', 'listing_studio:view'),
        ('office_admin', 'listing_studio:create'),
        ('office_admin', 'listing_studio:edit'),
        ('office_admin', 'listing_studio:share'),
        ('office_manager', 'listing_studio:view'),
        ('office_manager', 'listing_studio:create'),
        ('office_manager', 'listing_studio:edit'),
        ('office_manager', 'listing_studio:share'),
        ('office_user', 'listing_studio:view'),
        ('office_user', 'listing_studio:create'),
        ('office_user', 'listing_studio:edit'),
        ('office_user', 'listing_studio:share'),
        ('team_lead', 'listing_studio:view'),
        ('team_lead', 'listing_studio:create'),
        ('team_lead', 'listing_studio:edit'),
        ('team_lead', 'listing_studio:share'),
        ('agent', 'listing_studio:view'),
        ('agent', 'listing_studio:create'),
        ('agent', 'listing_studio:edit'),
        ('agent', 'listing_studio:share'),
        ('accountant', 'listing_studio:view'),
        ('human_resources', 'listing_studio:view')
) AS mapped("role", "permissionKey")
  ON template."role" = mapped."role"::"UserRole"
LEFT JOIN "OrganizationRoleTemplatePermission" AS existing
  ON existing."organizationRoleTemplateId" = template."id"
 AND existing."permissionKey" = mapped."permissionKey"
WHERE existing."id" IS NULL;
