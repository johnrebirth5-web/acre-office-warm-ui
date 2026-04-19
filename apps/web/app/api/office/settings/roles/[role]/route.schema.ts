import { z } from "zod";

export const saveOrganizationRoleTemplatePermissionsBodySchema = z.object({
  permissions: z.array(z.string()).optional()
});
