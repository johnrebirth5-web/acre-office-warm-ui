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

type OfficeAgentsClientProps = {
  snapshot: OfficeAgentsRosterSnapshot;
  canManageAgents: boolean;
  canManageOnboarding: boolean;
  canManageGoals: boolean;
  canManageTeams: boolean;
};

const onboardingStatusOptions = [
  { value: "", label: "全部入职状态" },
  { value: "not_started", label: "未开始" },
  { value: "in_progress", label: "进行中" },
  { value: "complete", label: "已完成" }
] as const;

const membershipStatusOptions = [
  { value: "", label: "全部成员状态" },
  { value: "active", label: "启用" },
  { value: "inactive", label: "停用" }
] as const;

function getMembershipStatusLabel(value: string) {
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

function getOnboardingStatusLabel(value: string) {
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
      setTeamError("请输入团队名称。");
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
        throw new Error(body?.error ?? "创建团队失败。");
      }

      setTeamName("");
      router.refresh();
    } catch (error) {
      setTeamError(error instanceof Error ? error.message : "创建团队失败。");
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
        throw new Error(body?.error ?? "更新团队失败。");
      }

      router.refresh();
    } catch (error) {
      setTeamError(error instanceof Error ? error.message : "更新团队失败。");
    } finally {
      setPendingAction(null);
    }
  }

  const rosterFilters = (
    <ListPageFilters as="form" className="office-agents-toolbar" method="get">
      <FilterField className="office-agents-search-field" label="搜索">
        <TextInput defaultValue={snapshot.filters.q} name="q" placeholder="搜索姓名、邮箱、头衔或团队" type="search" />
      </FilterField>
      <FilterField className="office-agents-filter-field" label="办公室">
        <SelectInput defaultValue={snapshot.filters.officeId} name="officeId">
          <option value="">全部办公室</option>
          {snapshot.filters.officeOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </FilterField>
      <FilterField className="office-agents-filter-field" label="角色">
        <SelectInput defaultValue={snapshot.filters.role} name="role">
          <option value="">全部角色</option>
          {snapshot.filters.roleOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </FilterField>
      <FilterField className="office-agents-filter-field" label="团队">
        <SelectInput defaultValue={snapshot.filters.teamId} name="teamId">
          <option value="">全部团队</option>
          {snapshot.filters.teamOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </FilterField>
      <FilterField className="office-agents-filter-field" label="入职">
        <SelectInput defaultValue={snapshot.filters.onboardingStatus} name="onboardingStatus">
          {onboardingStatusOptions.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </FilterField>
      <FilterField className="office-agents-membership-field" label="成员状态">
        <SelectInput defaultValue={snapshot.filters.membershipStatus} name="membershipStatus">
          {membershipStatusOptions.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </FilterField>
      <div className="office-filter-actions office-agents-filter-actions">
        <Button type="submit">应用筛选</Button>
        <Link className="office-button-secondary" href="/office/agents">
          重置
        </Link>
      </div>
    </ListPageFilters>
  );

  const rosterFooter = (
    <ListPageFooter
      controls={
        hasActiveRosterFilters ? (
          <Link className="office-list-page-button" href="/office/agents">
            清空筛选
          </Link>
        ) : null
      }
      summary={`当前范围内有 ${snapshot.rows.length} 条名册记录`}
    />
  );

  const teamsFooter = <ListPageFooter summary={`当前办公室范围内有 ${snapshot.teams.length} 个可见团队`} />;

  return (
    <ListPageStack className="office-agents-layout">
      <ListPageTableSection filters={rosterFilters} footer={rosterFooter} subtitle="无需离开后台工作流，即可搜索和筛选当前办公室名册。" title="经纪人名册">
        {snapshot.rows.length ? (
          <DataTable className="office-table office-agents-roster-table">
            <DataTableHeader className="office-agents-roster-head">
              <span>经纪人</span>
              <span>办公室</span>
              <span>角色</span>
              <span>团队</span>
              <span>成员状态</span>
              <span>入职</span>
              <span className="office-agents-roster-head-metric">工作量</span>
              <span className="office-agents-roster-head-metric">交易</span>
              <span className="office-agents-roster-head-metric">目标</span>
              <span className="office-agents-roster-head-metric">账单</span>
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
                    <StatusBadge tone={getMembershipTone(row.membershipStatusValue)}>{getMembershipStatusLabel(row.membershipStatus)}</StatusBadge>
                    <small>{row.membershipStatusValue === "active" ? "名册内" : "需要复核"}</small>
                  </span>
                  <span className="office-agents-roster-stack office-agents-roster-status">
                    <StatusBadge tone={getOnboardingTone(row.onboardingStatus)}>{getOnboardingStatusLabel(row.onboardingStatus)}</StatusBadge>
                    <small>{row.onboardingProgressLabel}</small>
                  </span>
                  <span className="office-agents-roster-stack office-agents-roster-metric">
                    <strong>{row.activeTasksCount} 个活动项</strong>
                    <small>{row.activeTasksCount === 0 ? "没有待处理工作量" : "当前已分配任务"}</small>
                  </span>
                  <span className="office-agents-roster-stack office-agents-roster-metric">
                    <strong>{row.transactionSummaryLabel}</strong>
                    <small>{row.openTransactionCount} 笔进行中交易</small>
                  </span>
                  <span className="office-agents-roster-stack office-agents-roster-metric">
                    <strong>{row.goalProgressSummary}</strong>
                    <small>90 天内已成交 {row.recentClosedTransactionCount} 笔</small>
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
            description="可以尝试放宽当前办公室、团队、入职或成员状态筛选。"
            title="当前名册筛选下没有匹配的经纪人"
          />
        )}
      </ListPageTableSection>

      <ListPageTableSection
        actions={<StatusBadge tone="neutral">{snapshot.teams.length} 个团队</StatusBadge>}
        footer={teamsFooter}
        subtitle="快速查看当前办公室范围内的团队、成员、活动工作和状态。"
        title="团队总览"
      >
        <div className="office-agents-team-inventory">
          <DataTable className="office-table office-agents-team-table">
            <DataTableHeader className="office-agents-team-table-head">
              <span>团队</span>
              <span>成员</span>
              <span>未完成任务</span>
              <span>进行中交易</span>
              <span>状态</span>
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
                  <StatusBadge tone={team.isActive ? "success" : "neutral"}>{team.isActive ? "启用" : "停用"}</StatusBadge>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
          {snapshot.teams.length === 0 ? <EmptyState description="创建第一个团队，开始把经纪人分组到名册中。" title="还没有团队" /> : null}
        </div>
      </ListPageTableSection>

      <ListPageSection
        subtitle="在这里创建、重命名、启用并维护团队。成员归属仍在每个经纪人资料内管理。"
        title="团队管理"
      >
        {canManageTeams ? (
          <form className="office-inline-form office-agents-team-create-form" onSubmit={handleCreateTeam}>
            <FormField className="office-inline-form-field" label="新团队名称">
              <TextInput onChange={(event) => setTeamName(event.target.value)} placeholder="创建团队" value={teamName} />
            </FormField>
            <Button disabled={pendingAction === "create-team"} type="submit">
              {pendingAction === "create-team" ? "创建中..." : "创建团队"}
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
                    <FormField className="office-agents-team-name-field" label="团队名称">
                      <TextInput defaultValue={team.name} name="name" readOnly={!canManageTeams} />
                    </FormField>
                    <StatusBadge tone={team.isActive ? "success" : "neutral"}>{team.isActive ? "启用" : "停用"}</StatusBadge>
                  </div>

                  <div className="office-secondary-meta-list">
                    <div className="office-secondary-meta-row">
                      <dt>Slug</dt>
                      <dd>{team.slug}</dd>
                    </div>
                    <div className="office-secondary-meta-row">
                      <dt>成员</dt>
                      <dd>{team.memberCount}</dd>
                    </div>
                    <div className="office-secondary-meta-row">
                      <dt>未完成任务</dt>
                      <dd>{team.openTaskCount}</dd>
                    </div>
                    <div className="office-secondary-meta-row">
                      <dt>进行中交易</dt>
                      <dd>{team.openTransactionCount}</dd>
                    </div>
                    <div className="office-secondary-meta-row">
                      <dt>入职进行中</dt>
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
                    {team.members.length === 0 ? <li className="office-agents-team-empty">还没有分配成员。</li> : null}
                  </ul>

                  {canManageTeams ? (
                    <div className="office-inline-form office-inline-form-compact">
                      <input name="isActive" type="hidden" value={String(team.isActive)} />
                      <Button disabled={pendingAction === `save-team:${team.id}`} type="submit" variant="secondary">
                        {pendingAction === `save-team:${team.id}` ? "保存中..." : "保存团队"}
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
                        {team.isActive ? "停用" : "重新启用"}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </form>
            ))}
            {snapshot.teams.length === 0 ? <EmptyState description="创建第一个团队，开始把经纪人分组到名册中。" title="还没有团队" /> : null}
          </div>
        </div>

        {!canManageAgents && !canManageOnboarding && !canManageGoals && !canManageTeams ? (
          <p className="office-form-helper">当前角色只能只读查看这个名册。</p>
        ) : null}
      </ListPageSection>
    </ListPageStack>
  );
}
