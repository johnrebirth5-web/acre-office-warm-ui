ALTER TYPE "TeamMembershipRole" RENAME VALUE 'leader_i' TO 'team_leader';
ALTER TYPE "TeamMembershipRole" RENAME VALUE 'leader_ii' TO 'junior_team_leader';

ALTER TABLE "Team" ADD COLUMN "parentTeamId" TEXT;

WITH inferred_team_parents AS (
  SELECT
    child_team_membership."teamId" AS child_team_id,
    MIN(parent_team_membership."teamId") AS parent_team_id,
    COUNT(DISTINCT parent_team_membership."teamId") AS parent_team_count
  FROM "TeamMembership" child_team_membership
  JOIN "TeamMembership" parent_team_membership
    ON parent_team_membership."organizationId" = child_team_membership."organizationId"
   AND parent_team_membership."membershipId" = child_team_membership."membershipId"
   AND parent_team_membership."teamId" <> child_team_membership."teamId"
   AND parent_team_membership."role" = 'junior_team_leader'
  WHERE child_team_membership."role" = 'team_leader'
  GROUP BY child_team_membership."teamId"
)
UPDATE "Team" AS child_team
SET "parentTeamId" = inferred.parent_team_id
FROM inferred_team_parents AS inferred
WHERE child_team."id" = inferred.child_team_id
  AND inferred.parent_team_count = 1;

CREATE INDEX "Team_organizationId_officeId_parentTeamId_idx"
  ON "Team"("organizationId", "officeId", "parentTeamId");

ALTER TABLE "Team"
  ADD CONSTRAINT "Team_parentTeamId_fkey"
  FOREIGN KEY ("parentTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
