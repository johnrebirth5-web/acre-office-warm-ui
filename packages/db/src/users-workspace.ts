import type { OfficeAgentProfileSnapshot, OfficeAgentsRosterSnapshot } from "./agents";
import type { OfficeAdminUserDetailSnapshot, OfficeAdminUsersSnapshot } from "./settings";

export type OfficeUsersWorkspaceView = "access" | "operations";

export type OfficeUsersWorkspaceSnapshot = {
  activeView: OfficeUsersWorkspaceView;
  availableViews: OfficeUsersWorkspaceView[];
  access: OfficeAdminUsersSnapshot | null;
  operations: OfficeAgentsRosterSnapshot | null;
};

export type OfficeUserDetailWorkspaceSnapshot = {
  access: OfficeAdminUserDetailSnapshot | null;
  operations: OfficeAgentProfileSnapshot | null;
};
