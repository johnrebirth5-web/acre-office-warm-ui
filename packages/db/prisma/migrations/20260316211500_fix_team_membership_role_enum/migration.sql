DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum enum_value
    JOIN pg_type enum_type ON enum_type.oid = enum_value.enumtypid
    WHERE enum_type.typname = 'TeamMembershipRole'
      AND enum_value.enumlabel = 'lead'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_enum enum_value
    JOIN pg_type enum_type ON enum_type.oid = enum_value.enumtypid
    WHERE enum_type.typname = 'TeamMembershipRole'
      AND enum_value.enumlabel = 'leader_i'
  ) THEN
    ALTER TYPE "TeamMembershipRole" RENAME VALUE 'lead' TO 'leader_i';
  END IF;
END
$$;

ALTER TYPE "TeamMembershipRole" ADD VALUE IF NOT EXISTS 'leader_ii';
