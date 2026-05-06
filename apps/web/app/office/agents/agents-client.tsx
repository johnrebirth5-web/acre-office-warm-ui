"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  Button,
  DataTable,
  DataTableBody,
  DataTableHeader,
  DataTableRow,
  EmptyState,
  FilterField,
  FormField,
  ListPageFilters,
  ListPageFooter,
  ListPageSection,
  ListPageStack,
  ListPageTableSection,
  SelectInput,
  StatusBadge,
  TextInput
} from "@acre/ui";
import type { OfficeAgentsRosterSnapshot } from "@acre/db";
import { useI18n } from "../../../lib/i18n/client";

type OfficeAgentsClientProps = {
  snapshot: OfficeAgentsRosterSnapshot;
  canManageAgents: boolean;
  canManageOnboarding: boolean;
  canManageGoals: boolean;
  canManageTeams: boolean;
};

const onboardingStatusOptions = [
  { value: "", enLabel: "All onboarding states", zhLabel: "全部入职状态" },
  { value: "not_started", enLabel: "Not started", zhLabel: "未开始" },
  { value: "in_progress", enLabel: "In progress", zhLabel: "进行中" },
  { value: "complete", enLabel: "Complete", zhLabel: "已完成" }
] as const;

const membershipStatusOptions = [
  { value: "", enLabel: "All member states", zhLabel: "全部成员状态" },
  { value: "active", enLabel: "Active", zhLabel: "启用" },
  { value: "inactive", enLabel: "Inactive", zhLabel: "停用" }
] as const;

function getMembershipStatusLabel(value: string, isZh: boolean) {
  if (!isZh) {
    return value;
  }

  switch (value.toLowerCase()) {
    case "active":
      return "启用";
    case "inactive":
      return "停用";
    case "invited":
      return "已邀请";
    default:
      return value;
  }
}

function getOnboardingStatusLabel(value: string, isZh: boolean) {
  if (!isZh) {
    return value;
  }

  switch (value.toLowerCase()) {
    case "complete":
      return "已完成";
    case "in progress":
      return "进行中";
    case "not started":
      return "未开始";
    default:
      return value;
  }
}

function getMembershipTone(value: OfficeAgentsRosterSnapshot["rows"][number]["membershipStatusValue"]) {
  if (value === "active") {
    return "success" as const;
  }

  if (value === "invited") {
    return "accent" as const;
  }

  return "neutral" as const;
}

function getOnboardingTone(value: string) {
  if (value === "Complete") {
    return "success" as const;
  }

  if (value === "In progress") {
    return "accent" as const;
  }

  return "warning" as const;
}

export function OfficeAgentsClient({
  snapshot,
  canManageAgents,
  canManageOnboarding,
  canManageGoals,
  canManageTeams
}: OfficeAgentsClientProps) {
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
  const router = useRouter();
  const [teamName, setTeamName] = useState("");
  const [teamError, setTeamError] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const hasActiveRosterFilters = Boolean(
    snapshot.filters.q ||
      snapshot.filters.officeId ||
      snapshot.filters.role ||
      snapshot.filters.teamId ||
      snapshot.filters.onboardingStatus ||
      snapshot.filters.membershipStatus
  );

  async function handleCreateTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!teamName.trim()) {
      setTeamError(isZh ? "请输入团队名称。" : "Team name is required.");
      return;
    }

    setPendingAction("create-team");
    setTeamError("");

    try {
      const response = await fetch("/api/office/agents/teams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: teamName })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? (isZh ? "创建团队失败。" : "Failed to create team."));
      }

      setTeamName("");
      router.refresh();
    } catch (error) {
      setTeamError(error instanceof Error ? error.message : isZh ? "创建团队失败。" : "Failed to create team.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSaveTeam(teamId: string, formData: FormData) {
    setPendingAction(`save-team:${teamId}`);
    setTeamError("");

    try {
      const response = await fetch(`/api/office/agents/teams/${teamId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: String(formData.get("name") ?? ""),
          isActive: formData.get("isActive") === "true"
        })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? (isZh ? "更新团队失败。" : "Failed to update team."));
      }

      router.refresh();
    } catch (error) {
      setTeamError(error instanceof Error ? error.message : isZh ? "更新团队失败。" : "Failed to update team.");
    } finally {
      setPendingAction(null);
    }
  }

  const rosterFilters = (
    <ListPageFilters as="form" className="office-agents-toolbar" method="get">
      <FilterField className="office-agents-search-field" label={isZh ? "搜索" : "Search"}>
        <TextInput defaultValue={snapshot.filters.q} name="q" placeholder={isZh ? "搜索姓名、邮箱、头衔或团队" : "Search name, email, title, or team"} type="search" />
      </FilterField>
      <FilterField className="office-agents-filter-field" label={isZh ? "办公室" : "Office"}>
        <SelectInput defaultValue={snapshot.filters.officeId} name="officeId">
          <option value="">{isZh ? "全部办公室" : "All offices"}</option>
          {snapshot.filters.officeOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </FilterField>
      <FilterField className="office-agents-filter-field" label={isZh ? "角色" : "Role"}>
        <SelectInput defaultValue={snapshot.filters.role} name="role">
          <option value="">{isZh ? "全部角色" : "All roles"}</option>
          {snapshot.filters.roleOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </FilterField>
      <FilterField className="office-agents-filter-field" label={isZh ? "团队" : "Team"}>
        <SelectInput defaultValue={snapshot.filters.teamId} name="teamId">
          <option value="">{isZh ? "全部团队" : "All teams"}</option>
          {snapshot.filters.teamOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </FilterField>
      <FilterField className="office-agents-filter-field" label={isZh ? "入职" : "Onboarding"}>
        <SelectInput defaultValue={snapshot.filters.onboardingStatus} name="onboardingStatus">
          {onboardingStatusOptions.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {isZh ? option.zhLabel : option.enLabel}
            </option>
          ))}
        </SelectInput>
      </FilterField>
      <FilterField className="office-agents-membership-field" label={isZh ? "成员状态" : "Membership"}>
        <SelectInput defaultValue={snapshot.filters.membershipStatus} name="membershipStatus">
          {membershipStatusOptions.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {isZh ? option.zhLabel : option.enLabel}
            </option>
          ))}
        </SelectInput>
      </FilterField>
      <div className="office-filter-actions office-agents-filter-actions">
        <Button type="submit">{isZh ? "应用筛选" : "Apply filters"}</Button>
        <Link className="office-button-secondary" href="/office/agents">
          {isZh ? "重置" : "Reset"}
        </Link>
      </div>
    </ListPageFilters>
  );

  const rosterFooter = (
    <ListPageFooter
      controls={
        hasActiveRosterFilters ? (
          <Link className="office-list-page-button" href="/office/agents">
            {isZh ? "清空筛选" : "Clear filters"}
          </Link>
        ) : null
      }
      summary={isZh ? `当前范围内有 ${snapshot.rows.length} 条名册记录` : `${snapshot.rows.length} roster rows in the current scope`}
    />
  );

  const teamsFooter = <ListPageFooter summary={isZh ? `当前办公室范围内有 ${snapshot.teams.length} 个可见团队` : `${snapshot.teams.length} visible teams in the current office scope`} />;

  return (
    <ListPageStack className="office-agents-layout">
      <ListPageTableSection
        filters={rosterFilters}
        footer={rosterFooter}
        subtitle={isZh ? "无需离开后台工作流，即可搜索和筛选当前办公室名册。" : "Search and filter the current office roster without leaving the back-office workflow."}
        title={isZh ? "经纪人名册" : "Agent roster"}
      >
        {snapshot.rows.length ? (
          <DataTable className="office-table office-agents-roster-table">
            <DataTableHeader className="office-agents-roster-head">
              <span>{isZh ? "经纪人" : "Agent"}</span>
              <span>{isZh ? "办公室" : "Office"}</span>
              <span>{isZh ? "角色" : "Role"}</span>
              <span>{isZh ? "团队" : "Team"}</span>
              <span>{isZh ? "成员状态" : "Membership"}</span>
              <span>{isZh ? "入职" : "Onboarding"}</span>
              <span className="office-agents-roster-head-metric">{isZh ? "工作量" : "Workload"}</span>
              <span className="office-agents-roster-head-metric">{isZh ? "交易" : "Transactions"}</span>
              <span className="office-agents-roster-head-metric">{isZh ? "目标" : "Goals"}</span>
              <span className="office-agents-roster-head-metric">{isZh ? "账单" : "Billing"}</span>
            </DataTableHeader>
            <DataTableBody>
              {snapshot.rows.map((row) => (
                <Link className="office-data-table-row office-agents-roster-row" href={row.href} key={row.membershipId} role="row">
                  <span className="office-data-table-row-main office-agents-roster-stack office-agents-roster-primary">
                    <strong>{row.name}</strong>
                    <small>{row.email}</small>
                  </span>
                  <span className="office-agents-roster-plain">{row.officeName}</span>
                  <span className="office-agents-roster-stack">
                    <strong>{row.role}</strong>
                    <small>{row.title}</small>
                  </span>
                  <span className="office-agents-roster-plain">{row.teamLabel}</span>
                  <span className="office-agents-roster-stack office-agents-roster-status">
                    <StatusBadge tone={getMembershipTone(row.membershipStatusValue)}>{getMembershipStatusLabel(row.membershipStatus, isZh)}</StatusBadge>
                    <small>{row.membershipStatusValue === "active" ? (isZh ? "名册内" : "In roster") : isZh ? "需要复核" : "Needs review"}</small>
                  </span>
                  <span className="office-agents-roster-stack office-agents-roster-status">
                    <StatusBadge tone={getOnboardingTone(row.onboardingStatus)}>{getOnboardingStatusLabel(row.onboardingStatus, isZh)}</StatusBadge>
                    <small>{row.onboardingProgressLabel}</small>
                  </span>
                  <span className="office-agents-roster-stack office-agents-roster-metric">
                    <strong>{isZh ? `${row.activeTasksCount} 个活动项` : `${row.activeTasksCount} active`}</strong>
                    <small>{row.activeTasksCount === 0 ? (isZh ? "没有待处理工作量" : "No open workload") : isZh ? "当前已分配任务" : "Tasks currently assigned"}</small>
                  </span>
                  <span className="office-agents-roster-stack office-agents-roster-metric">
                    <strong>{row.transactionSummaryLabel}</strong>
                    <small>{isZh ? `${row.openTransactionCount} 笔进行中交易` : `${row.openTransactionCount} open pipeline`}</small>
                  </span>
                  <span className="office-agents-roster-stack office-agents-roster-metric">
                    <strong>{row.goalProgressSummary}</strong>
                    <small>{isZh ? `90 天内已成交 ${row.recentClosedTransactionCount} 笔` : `${row.recentClosedTransactionCount} closed in 90d`}</small>
                  </span>
                  <span className="office-agents-roster-stack office-agents-roster-metric">
                    <strong>{row.billingBalanceLabel}</strong>
                    <small>{row.billingSummaryLabel}</small>
                  </span>
                </Link>
              ))}
            </DataTableBody>
          </DataTable>
        ) : (
          <EmptyState
            description={isZh ? "可以尝试放宽当前办公室、团队、入职或成员状态筛选。" : "Try relaxing the current office, team, onboarding, or membership filters."}
            title={isZh ? "当前名册筛选下没有匹配的经纪人" : "No agents matched the current roster filters"}
          />
        )}
      </ListPageTableSection>

      <ListPageTableSection
        actions={<StatusBadge tone="neutral">{isZh ? `${snapshot.teams.length} 个团队` : `${snapshot.teams.length} total teams`}</StatusBadge>}
        footer={teamsFooter}
        subtitle={isZh ? "快速查看当前办公室范围内的团队、成员、活动工作和状态。" : "Quick inventory of teams, membership, active work, and status across the current office scope."}
        title={isZh ? "团队总览" : "Teams overview"}
      >
        <div className="office-agents-team-inventory">
          <DataTable className="office-table office-agents-team-table">
            <DataTableHeader className="office-agents-team-table-head">
              <span>{isZh ? "团队" : "Team"}</span>
              <span>{isZh ? "成员" : "Members"}</span>
              <span>{isZh ? "未完成任务" : "Open tasks"}</span>
              <span>{isZh ? "进行中交易" : "Open transactions"}</span>
              <span>{isZh ? "状态" : "Status"}</span>
            </DataTableHeader>
            <DataTableBody>
              {snapshot.teams.map((team) => (
                <DataTableRow className="office-agents-team-table-row" key={`team-summary-${team.id}`}>
                  <span className="office-data-table-row-main">
                    <strong>{team.name}</strong>
                    <small>{team.slug}</small>
                  </span>
                  <span>{team.memberCount}</span>
                  <span>{team.openTaskCount}</span>
                  <span>{team.openTransactionCount}</span>
                  <StatusBadge tone={team.isActive ? "success" : "neutral"}>{team.isActive ? (isZh ? "启用" : "Active") : isZh ? "停用" : "Inactive"}</StatusBadge>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
          {snapshot.teams.length === 0 ? <EmptyState description={isZh ? "创建第一个团队，开始把经纪人分组到名册中。" : "Create your first team to start grouping agents into rosters."} title={isZh ? "还没有团队" : "No teams yet"} /> : null}
        </div>
      </ListPageTableSection>

      <ListPageSection
        subtitle={isZh ? "在这里创建、重命名、启用并维护团队。成员归属仍在每个经纪人资料内管理。" : "Create, rename, activate, and maintain teams here. Membership remains managed inside each agent profile."}
        title={isZh ? "团队管理" : "Team administration"}
      >
        {canManageTeams ? (
          <form className="office-inline-form office-agents-team-create-form" onSubmit={handleCreateTeam}>
            <FormField className="office-inline-form-field" label={isZh ? "新团队名称" : "New team name"}>
              <TextInput onChange={(event) => setTeamName(event.target.value)} placeholder={isZh ? "创建团队" : "Create team"} value={teamName} />
            </FormField>
            <Button disabled={pendingAction === "create-team"} type="submit">
              {pendingAction === "create-team" ? (isZh ? "创建中..." : "Creating...") : isZh ? "创建团队" : "Create team"}
            </Button>
            {teamError ? <p className="office-form-error">{teamError}</p> : null}
          </form>
        ) : null}

        <div className="office-agents-team-admin-shell">
          <div className="office-agents-team-grid">
            {snapshot.teams.map((team) => (
              <form
                className="office-section-card office-agents-team-card"
                key={team.id}
                onSubmit={async (event) => {
                  event.preventDefault();
                  await handleSaveTeam(team.id, new FormData(event.currentTarget));
                }}
              >
                <div className="office-section-body">
                  <div className="office-agents-team-card-head">
                    <FormField className="office-agents-team-name-field" label={isZh ? "团队名称" : "Team name"}>
                      <TextInput defaultValue={team.name} name="name" readOnly={!canManageTeams} />
                    </FormField>
                    <StatusBadge tone={team.isActive ? "success" : "neutral"}>{team.isActive ? (isZh ? "启用" : "Active") : isZh ? "停用" : "Inactive"}</StatusBadge>
                  </div>

                  <div className="office-secondary-meta-list">
                    <div className="office-secondary-meta-row">
                      <dt>Slug</dt>
                      <dd>{team.slug}</dd>
                    </div>
                    <div className="office-secondary-meta-row">
                      <dt>{isZh ? "成员" : "Members"}</dt>
                      <dd>{team.memberCount}</dd>
                    </div>
                    <div className="office-secondary-meta-row">
                      <dt>{isZh ? "未完成任务" : "Open tasks"}</dt>
                      <dd>{team.openTaskCount}</dd>
                    </div>
                    <div className="office-secondary-meta-row">
                      <dt>{isZh ? "进行中交易" : "Open transactions"}</dt>
                      <dd>{team.openTransactionCount}</dd>
                    </div>
                    <div className="office-secondary-meta-row">
                      <dt>{isZh ? "入职进行中" : "Onboarding in progress"}</dt>
                      <dd>{team.onboardingInProgressCount}</dd>
                    </div>
                  </div>

                  <ul className="office-agents-team-members">
                    {team.members.map((member) => (
                      <li key={member.membershipId}>
                        <Link href={`/office/agents/${member.membershipId}`}>{member.label}</Link>
                        <span>{member.role}</span>
                      </li>
                    ))}
                    {team.members.length === 0 ? <li className="office-agents-team-empty">{isZh ? "还没有分配成员。" : "No members assigned yet."}</li> : null}
                  </ul>

                  {canManageTeams ? (
                    <div className="office-inline-form office-inline-form-compact">
                      <input name="isActive" type="hidden" value={String(team.isActive)} />
                      <Button disabled={pendingAction === `save-team:${team.id}`} type="submit" variant="secondary">
                        {pendingAction === `save-team:${team.id}` ? (isZh ? "保存中..." : "Saving...") : isZh ? "保存团队" : "Save team"}
                      </Button>
                      <Button
                        disabled={pendingAction === `save-team:${team.id}`}
                        onClick={async () => {
                          const formData = new FormData();
                          formData.set("name", team.name);
                          formData.set("isActive", String(!team.isActive));
                          await handleSaveTeam(team.id, formData);
                        }}
                        type="button"
                        variant="ghost"
                      >
                        {team.isActive ? (isZh ? "停用" : "Deactivate") : isZh ? "重新启用" : "Reactivate"}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </form>
            ))}
            {snapshot.teams.length === 0 ? <EmptyState description={isZh ? "创建第一个团队，开始把经纪人分组到名册中。" : "Create your first team to start grouping agents into rosters."} title={isZh ? "还没有团队" : "No teams yet"} /> : null}
          </div>
        </div>

        {!canManageAgents && !canManageOnboarding && !canManageGoals && !canManageTeams ? (
          <p className="office-form-helper">{isZh ? "当前角色只能只读查看这个名册。" : "This roster is read-only for your current role."}</p>
        ) : null}
      </ListPageSection>
    </ListPageStack>
  );
}
