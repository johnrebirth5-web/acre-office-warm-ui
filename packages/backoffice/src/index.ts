import type { UserRole } from "@acre/auth";

export type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
  description: string;
};

export type WorkspaceSection = {
  id: string;
  title: string;
  summary: string;
  items: NavItem[];
};

export type OrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
};

export type OfficeSummary = {
  id: string;
  name: string;
  slug: string;
  market: string;
  companyLabel: string;
};

export type AcreMember = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  officeId: string;
  title: string;
};

export type AgentTask = {
  id: string;
  title: string;
  subtitle: string;
  dueLabel: string;
  priority: "High" | "Medium" | "Low";
};

export type ListingSnapshot = {
  id: string;
  name: string;
  area: string;
  city: string;
  price: string;
  status: string;
  hook: string;
  sourceUrl: string;
  isPublic: boolean;
  trackedClicks: number;
};

export type ClientSnapshot = {
  id: string;
  fullName: string;
  stage: string;
  intent: string;
  budget: string;
  areas: string[];
  lastContactLabel: string;
  nextFollowUpLabel: string;
  source: string;
};

export type EventSnapshot = {
  id: string;
  title: string;
  kind: string;
  startsAtLabel: string;
  location: string;
  visibility: string;
  rsvpCount: number;
};

export type NotificationSnapshot = {
  id: string;
  kind: "system" | "listing" | "follow_up" | "event";
  title: string;
  body: string;
  actionLabel: string;
};

export type ResourceSnapshot = {
  id: string;
  type: "training_video" | "document" | "template" | "playbook";
  title: string;
  summary: string;
  tags: string[];
};

export type VendorSnapshot = {
  id: string;
  category: string;
  name: string;
  headline: string;
  neighborhoods: string[];
};

export type MetricCard = {
  label: string;
  value: string;
  trend: string;
};

export type OfficeUpdate = {
  id: string;
  title: string;
  timeLabel: string;
  details: string[];
};

export type OfficeLink = {
  id: string;
  label: string;
  kind: string;
};

export type TransactionSnapshot = {
  id: string;
  label: string;
  amount: string;
  stage: string;
  owner: string;
};

export type TransactionStatus = "Opportunity" | "Active" | "Pending" | "Closed" | "Cancelled";

export type TransactionRecord = {
  id: string;
  address: string;
  importantDate: string;
  price: string;
  owner: string;
  representing: string;
  status: TransactionStatus;
  volume: number;
  isFlagged?: boolean;
};

export type PipelineBucket = {
  status: TransactionStatus;
  count: number;
  volumeLabel: string;
  transactions: TransactionRecord[];
};

export type CompanySettingsSnapshot = {
  accountNumber: string;
  packagePlan: string;
  companyName: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  fax: string;
  officeName: string;
  officeCode: string;
  esignCertificateOnCompletion: boolean;
};

export type CommissionParticipantDraft = {
  id: string;
  name: string;
  role: string;
  splitLabel: string;
  notes?: string;
};

export type CreateTransactionDraft = {
  transactionType: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  contractDate: string;
  salePrice: string;
  buyerExpirationDate: string;
  listingDate: string;
  listingExpirationDate: string;
  closingDate: string;
  agentName: string;
  teamLeader: string;
  licensedAgentName: string;
  companyReferral: "Yes" | "No";
  companyReferralEmployeeName: string;
  brokerageName: string;
  sourceNotes: string;
  commissionPercent: string;
  referralPercent: string;
  participants: CommissionParticipantDraft[];
  referralRules: string[];
};

export type AgentDashboardSnapshot = {
  organization: OrganizationSummary;
  user: AcreMember;
  tasks: AgentTask[];
  listings: ListingSnapshot[];
  notifications: NotificationSnapshot[];
  resources: ResourceSnapshot[];
  metrics: MetricCard[];
};

export type OfficeDashboardSnapshot = {
  organization: OrganizationSummary;
  offices: OfficeSummary[];
  manager: AcreMember;
  metrics: MetricCard[];
  listings: ListingSnapshot[];
  events: EventSnapshot[];
  resources: ResourceSnapshot[];
  workflowNotes: string[];
  goal: {
    target: string;
    progressPercent: number;
    currentValue: string;
    timeLeft: string;
  };
  weeklyUpdates: OfficeUpdate[];
  usefulLinks: OfficeLink[];
  trainingLinks: OfficeLink[];
  recentTransactions: TransactionSnapshot[];
};

export const organization: OrganizationSummary = {
  id: "org-acre",
  name: "Acre",
  slug: "acre",
  timezone: "America/New_York"
};

export const offices: OfficeSummary[] = [
  { id: "office-ny", name: "Acre NY Realty Inc", slug: "acre-ny", market: "New York Sales", companyLabel: "Primary office" },
  { id: "office-nj", name: "Acre NJ LLC", slug: "acre-nj", market: "New Jersey Sales", companyLabel: "Expansion office" },
  { id: "office-rentals", name: "Acre NY Rentals LLC", slug: "acre-rentals", market: "NY Rentals", companyLabel: "Leasing arm" }
];

export const members: AcreMember[] = [
  {
    id: "member-jane",
    firstName: "Jane",
    lastName: "Wu",
    email: "jane@acre.com",
    role: "agent",
    officeId: "office-ny",
    title: "Senior Agent"
  },
  {
    id: "member-simon",
    firstName: "Simon",
    lastName: "Park",
    email: "simon@acre.com",
    role: "office_manager",
    officeId: "office-ny",
    title: "Office Manager"
  },
  {
    id: "member-naomi",
    firstName: "Naomi",
    lastName: "Chen",
    email: "naomi@acre.com",
    role: "office_admin",
    officeId: "office-ny",
    title: "Operations Admin"
  }
];

export const agentSections: WorkspaceSection[] = [
  {
    id: "overview",
    title: "Front Office",
    summary: "Daily follow-up, outreach, commitments, and the next handoff into formal Back Office workflows.",
    items: [
      {
        href: "/agent/dashboard",
        label: "Dashboard",
        shortLabel: "Home",
        description: "Today action queue, client pressure, commitments, and Back Office handoff."
      },
      {
        href: "/agent/clients",
        label: "Clients",
        shortLabel: "Clients",
        description: "Pipeline, reminders, and the next action set for active client work."
      },
      {
        href: "/agent/notifications",
        label: "Activity",
        shortLabel: "Alerts",
        description: "Commitments, office notices, and reminder-driven follow-through."
      },
      {
        href: "/agent/resources",
        label: "Resources",
        shortLabel: "Resources",
        description: "Training, documents, templates, and vendor shortcuts for field execution."
      }
    ]
  }
];

export const officeSections: WorkspaceSection[] = [
  {
    id: "operations",
    title: "Office Console",
    summary: "Control listings, campaigns, events, and analytics across the company.",
    items: [
      {
        href: "/office/dashboard",
        label: "Analytics",
        shortLabel: "Analytics",
        description: "Weekly visibility into listing distribution, clicks, and agent activity."
      },
      {
        href: "/office/listings",
        label: "Listings Admin",
        shortLabel: "Listings",
        description: "Ingest URLs, run AI parsing, review status changes, and publish inventory."
      },
      {
        href: "/office/events",
        label: "Events",
        shortLabel: "Events",
        description: "Publish workshops and offline events, monitor RSVP, and send reminders."
      },
      {
        href: "/office/resources",
        label: "Resources Admin",
        shortLabel: "Resources",
        description: "Manage training media, vendor cards, templates, and searchable docs."
      }
    ]
  }
];

export const agentTasks: AgentTask[] = [
  {
    id: "task-followup-lic",
    title: "Follow up LIC investor lead",
    subtitle: "Last contact 3 days ago. Interest: 1B / LIC / budget $950k.",
    dueLabel: "Due today",
    priority: "High"
  },
  {
    id: "task-poster-orchard",
    title: "Generate poster for The Orchard",
    subtitle: "Use new skyline headline and update QR-tracked sharing link.",
    dueLabel: "Due in 4h",
    priority: "Medium"
  },
  {
    id: "task-rsvp-workshop",
    title: "RSVP for Thursday workshop",
    subtitle: "Workshop: New Development Buyer Objections.",
    dueLabel: "Closes tonight",
    priority: "Low"
  }
];

export const listings: ListingSnapshot[] = [
  {
    id: "listing-orchard",
    name: "The Orchard",
    area: "Long Island City",
    city: "New York",
    price: "$1.42M",
    status: "Active",
    hook: "7 min walk to subway, corner light, gym and terrace.",
    sourceUrl: "https://acre.example/listings/the-orchard",
    isPublic: true,
    trackedClicks: 138
  },
  {
    id: "listing-riverline",
    name: "Riverline West",
    area: "Jersey City",
    city: "New Jersey",
    price: "$865K",
    status: "Hot link",
    hook: "Highest click-through this week from WeChat tracked links.",
    sourceUrl: "https://acre.example/listings/riverline-west",
    isPublic: true,
    trackedClicks: 216
  },
  {
    id: "listing-kent",
    name: "Kent House",
    area: "Brooklyn",
    city: "New York",
    price: "$2.18M",
    status: "Off-market watch",
    hook: "Status monitor detected possible developer update overnight.",
    sourceUrl: "https://acre.example/listings/kent-house",
    isPublic: false,
    trackedClicks: 42
  },
  {
    id: "listing-aurelia",
    name: "Aurelia Tower",
    area: "Downtown Brooklyn",
    city: "New York",
    price: "$1.08M",
    status: "Pending review",
    hook: "Fresh brochure uploaded. AI parse flagged school and tax fields for office review.",
    sourceUrl: "https://acre.example/listings/aurelia-tower",
    isPublic: false,
    trackedClicks: 19
  }
];

export const clients: ClientSnapshot[] = [
  {
    id: "client-evelyn",
    fullName: "Evelyn Zhao",
    stage: "Warm",
    intent: "Investor",
    budget: "$850k - $1.05M",
    areas: ["Long Island City", "Astoria"],
    lastContactLabel: "3 days ago",
    nextFollowUpLabel: "Today at 5 PM",
    source: "WeChat OCR import"
  },
  {
    id: "client-daniel",
    fullName: "Daniel Morgan",
    stage: "Tour booked",
    intent: "End-user",
    budget: "$1.2M - $1.5M",
    areas: ["Brooklyn Heights", "Downtown Brooklyn"],
    lastContactLabel: "Yesterday",
    nextFollowUpLabel: "After Saturday tour",
    source: "Website inquiry"
  },
  {
    id: "client-iris",
    fullName: "Iris Chen",
    stage: "Nurture",
    intent: "Rental",
    budget: "$4,800 / month",
    areas: ["Midtown", "Long Island City"],
    lastContactLabel: "1 week ago",
    nextFollowUpLabel: "Thursday morning",
    source: "Agent manual entry"
  }
];

export const events: EventSnapshot[] = [
  {
    id: "event-workshop",
    title: "New Development Buyer Objections",
    kind: "Workshop",
    startsAtLabel: "Thu 7:00 PM",
    location: "Zoom room",
    visibility: "All agents",
    rsvpCount: 54
  },
  {
    id: "event-appreciation",
    title: "Corporate Appreciation Night",
    kind: "Field Event",
    startsAtLabel: "Sat 6:30 PM",
    location: "Hudson Yards",
    visibility: "Invite-only",
    rsvpCount: 30
  }
];

export const notifications: NotificationSnapshot[] = [
  {
    id: "note-system-1",
    kind: "event",
    title: "Corporate Appreciation Night",
    body: "RSVP in one tap. Reminder will trigger 24 hours before the event.",
    actionLabel: "RSVP now"
  },
  {
    id: "note-system-2",
    kind: "event",
    title: "New Development Workshop",
    body: "Virtual session. Reminder carries the meeting link directly.",
    actionLabel: "View event"
  },
  {
    id: "note-listing-1",
    kind: "listing",
    title: "Kent House status monitor",
    body: "A listing status monitor flagged one project as potentially off-market.",
    actionLabel: "Review listing"
  }
];

export const resources: ResourceSnapshot[] = [
  {
    id: "resource-training-1",
    type: "training_video",
    title: "LIC Inventory Positioning",
    summary: "Short training on how to frame LIC projects for investors versus end-users.",
    tags: ["training", "LIC", "positioning"]
  },
  {
    id: "resource-doc-1",
    type: "document",
    title: "Acre Brand Voice Guide",
    summary: "Internal tone guide used by the reply assistant and listing writer.",
    tags: ["brand", "ai", "copy"]
  },
  {
    id: "resource-template-1",
    type: "template",
    title: "WeChat Follow-up Starter Pack",
    summary: "Editable response templates for warm leads, tour reminders, and objection handling.",
    tags: ["template", "wechat", "follow-up"]
  }
];

export const vendors: VendorSnapshot[] = [
  {
    id: "vendor-loanwise",
    category: "Mortgage",
    name: "Loanwise Capital",
    headline: "Fast pre-approval partner for condo and investor cases.",
    neighborhoods: ["Long Island City", "Brooklyn", "Jersey City"]
  },
  {
    id: "vendor-harbor-law",
    category: "Attorney",
    name: "Harbor Law Group",
    headline: "Closing counsel experienced with new development deals.",
    neighborhoods: ["Manhattan", "Brooklyn"]
  },
  {
    id: "vendor-pinnacle",
    category: "Insurance",
    name: "Pinnacle Coverage",
    headline: "Homeowner and landlord package options for investor clients.",
    neighborhoods: ["Queens", "Brooklyn", "Jersey City"]
  }
];

export const officeWorkflowNotes = [
  "URL parsing should output normalized sponsor, transit, school, and investment fields.",
  "Every agent share link must support individual tracking for clicks and downstream lead capture.",
  "OCR CRM intake should write structured needs summaries and next follow-up timestamps.",
  "Resource hub needs one search surface across videos, docs, templates, and vendor cards."
];

export const officeWeeklyUpdates: OfficeUpdate[] = [
  {
    id: "update-launch-party",
    title: "Launch Party @ Stanhope",
    timeLabel: "[Thu 1.29]",
    details: ["Time: 5:00 - 7:00 PM", "Location: 196 Stanhope St, Brooklyn, NY 11237"]
  },
  {
    id: "update-commercial-workshop",
    title: "Commercial Workshop - Ivan",
    timeLabel: "[Thu 1.29]",
    details: ["Time: 8:30 - 9:30 PM", "Zoom: https://us06web.zoom.us/j/85958213872"]
  },
  {
    id: "update-weekly-meeting",
    title: "Acre Weekly Meeting",
    timeLabel: "[Thu 2.5]",
    details: ["Time: 10:00 - 10:30 AM", "Join Zoom Meeting", "https://us06web.zoom.us/j/88901672776"]
  }
];

export const officeUsefulLinks: OfficeLink[] = [
  { id: "link-rebate", label: "Rebate Application Form", kind: "Form" },
  { id: "link-reimbursement", label: "Reimbursement Form", kind: "Form" },
  { id: "link-referral", label: "External Referral Info Collection Form", kind: "Form" },
  { id: "link-cyof", label: "CYOF Form", kind: "Form" },
  { id: "link-policy", label: "Reimbursement Policy", kind: "Policy" }
];

export const officeTrainingLinks: OfficeLink[] = [
  { id: "training-video", label: "Back Office Agent Training video", kind: "Training" },
  { id: "training-transaction", label: "How to create a transaction", kind: "Guide" },
  { id: "training-esign", label: "Esignature", kind: "Guide" },
  { id: "training-state-forms", label: "How to access state and association forms", kind: "Guide" },
  { id: "training-buyer-offers", label: "Buyer Offers", kind: "Guide" }
];

export const transactions: TransactionRecord[] = [
  {
    id: "tx-600-frank",
    address: "600 Frank E Rodgers Blvd S, Harrison, NJ 07029",
    importantDate: "",
    price: "$ 2,470",
    owner: "Siqi Fang",
    representing: "buyer",
    status: "Active",
    volume: 2470
  },
  {
    id: "tx-70-christopher",
    address: "70 Christopher Columbus Dr, Jersey City, NJ 07302",
    importantDate: "",
    price: "$ 3,585",
    owner: "Siqi Fang",
    representing: "buyer",
    status: "Active",
    volume: 3585
  },
  {
    id: "tx-350-west-50",
    address: "350 West 50th Street, New York, NY 10019",
    importantDate: "",
    price: "$ 3,500",
    owner: "Ziling (Lynn) Liu",
    representing: "buyer",
    status: "Active",
    volume: 3500
  },
  {
    id: "tx-61-oak",
    address: "61 Oak Ave, Eastchester, NY",
    importantDate: "",
    price: "$ 800,000",
    owner: "I-chuan Wang",
    representing: "buyer",
    status: "Active",
    volume: 800000
  },
  {
    id: "tx-3820-parson",
    address: "3820 Parson Blvd, flushing, NY 11354",
    importantDate: "expires: Dec 26, 2025",
    price: "$ 625,000",
    owner: "Queenie Cao",
    representing: "buyer",
    status: "Active",
    volume: 625000,
    isFlagged: true
  },
  {
    id: "tx-171-bagley",
    address: "171-06 Bagley ave, Flushing, NY",
    importantDate: "",
    price: "$ 1,159,000",
    owner: "I-chuan Wang",
    representing: "buyer",
    status: "Active",
    volume: 1159000
  },
  {
    id: "tx-280-east-2",
    address: "280 East 2 nd st #1110, New York, NY 10011",
    importantDate: "",
    price: "$ 3,395",
    owner: "I-chuan Wang",
    representing: "buyer",
    status: "Active",
    volume: 3395
  },
  {
    id: "tx-2-north-6",
    address: "2 North 6th Place, Brooklyn, NY 11249",
    importantDate: "",
    price: "$ 4,800",
    owner: "Alice Tang",
    representing: "seller",
    status: "Active",
    volume: 4800
  },
  {
    id: "tx-susie-shrader",
    address: "Susie Shrader Rental",
    importantDate: "",
    price: "$ 0",
    owner: "Alice Tang",
    representing: "buyer",
    status: "Active",
    volume: 0
  },
  {
    id: "tx-50-dekalb",
    address: "50 Dekalb Avenue #N2, White Plains, NY 10605",
    importantDate: "expires: Jul 27, 2026",
    price: "$ 500,000",
    owner: "I-chuan Wang",
    representing: "buyer",
    status: "Active",
    volume: 500000
  },
  {
    id: "tx-63-underhill",
    address: "63 Underhill Rd, Scarsdale, NY 10583",
    importantDate: "",
    price: "$ 1,600,000",
    owner: "I-chuan Wang",
    representing: "buyer",
    status: "Active",
    volume: 1600000
  },
  {
    id: "tx-16-richardson",
    address: "16 Richardson Pl, Eastchester, NY 10709",
    importantDate: "",
    price: "$ 779,000",
    owner: "I-chuan Wang",
    representing: "buyer",
    status: "Active",
    volume: 779000
  },
  {
    id: "tx-hossain-rental",
    address: "M Hossain Rental",
    importantDate: "",
    price: "$ 0",
    owner: "Alice Tang",
    representing: "buyer",
    status: "Active",
    volume: 0
  },
  {
    id: "tx-corrieri-rental",
    address: "A. Corrieri Rental",
    importantDate: "",
    price: "$ 0",
    owner: "Alice Tang",
    representing: "buyer",
    status: "Active",
    volume: 0
  },
  {
    id: "tx-128-2nd-daichang",
    address: "128 2nd Avenue(大肠), Manhattan, NY 10003",
    importantDate: "",
    price: "$ 450,000",
    owner: "Wanli(Olivia) Gao",
    representing: "buyer",
    status: "Opportunity",
    volume: 450000
  },
  {
    id: "tx-128-2nd-rental",
    address: "128 2nd Avenue, Manhattan, NY 10003",
    importantDate: "",
    price: "$ 4,200",
    owner: "Wanli(Olivia) Gao",
    representing: "tenant",
    status: "Opportunity",
    volume: 4200
  },
  {
    id: "tx-william-rental",
    address: "William H. Rental",
    importantDate: "",
    price: "$ 0",
    owner: "Alice Tang",
    representing: "buyer",
    status: "Opportunity",
    volume: 0
  },
  {
    id: "tx-128-2nd-ph",
    address: "128 2ND Avenue #PH, Manhattan, NY 10003",
    importantDate: "",
    price: "$ 1,250,000",
    owner: "Wanli(Olivia) Gao",
    representing: "buyer",
    status: "Opportunity",
    volume: 1250000
  },
  {
    id: "tx-graham-court",
    address: "Graham Court 4F, Brooklyn, NY 11206",
    importantDate: "",
    price: "$ 925,000",
    owner: "Jane Wu",
    representing: "buyer",
    status: "Opportunity",
    volume: 925000
  },
  {
    id: "tx-127-clarkson",
    address: "127 Clarkson Ave, Brooklyn, NY 11226",
    importantDate: "",
    price: "$ 3,250",
    owner: "Simon Park",
    representing: "tenant",
    status: "Opportunity",
    volume: 3250
  },
  {
    id: "tx-saaj-rental",
    address: "Saaj Rental",
    importantDate: "",
    price: "$ 0",
    owner: "Alice Tang",
    representing: "buyer",
    status: "Opportunity",
    volume: 0
  },
  {
    id: "tx-41-09-41st",
    address: "41-09 41st St, Sunnyside, NY 11104",
    importantDate: "",
    price: "$ 515,000",
    owner: "Naomi Chen",
    representing: "seller",
    status: "Opportunity",
    volume: 515000
  },
  {
    id: "tx-45-10-court-square",
    address: "45-10 Court Square W, Long Island City, NY 11101",
    importantDate: "",
    price: "$ 0",
    owner: "Simon Park",
    representing: "seller",
    status: "Opportunity",
    volume: 0
  },
  {
    id: "tx-phoebe-rental",
    address: "Phoebe Lee Rental",
    importantDate: "",
    price: "$ 0",
    owner: "Alice Tang",
    representing: "buyer",
    status: "Opportunity",
    volume: 0
  },
  {
    id: "tx-127-01-89th",
    address: "127-01 89th Ave, Richmond Hill, NY 11418",
    importantDate: "",
    price: "$ 699,000",
    owner: "Queenie Cao",
    representing: "buyer",
    status: "Opportunity",
    volume: 699000
  },
  {
    id: "tx-10-city-point",
    address: "10 City Point #25A, Brooklyn, NY 11201",
    importantDate: "",
    price: "$ 1,020,000",
    owner: "Naomi Chen",
    representing: "buyer",
    status: "Opportunity",
    volume: 1020000
  },
  {
    id: "tx-215-park",
    address: "215 Park Row #6C, New York, NY 10038",
    importantDate: "",
    price: "$ 2,950",
    owner: "Simon Park",
    representing: "tenant",
    status: "Opportunity",
    volume: 2950
  }
];

export const recentTransactions: TransactionSnapshot[] = transactions.slice(0, 3).map((transaction) => ({
  id: transaction.id,
  label: transaction.address,
  amount: transaction.price,
  stage: transaction.status.toLowerCase(),
  owner: transaction.owner
}));

export const companySettings: CompanySettingsSnapshot = {
  accountNumber: "17978",
  packagePlan: "Enterprise",
  companyName: "Acre NY Realty Inc",
  streetAddress: "45-10 Court Square W, FL 1",
  city: "Long Island",
  state: "NY",
  zipCode: "11101",
  phone: "201-676-0856",
  fax: "",
  officeName: "",
  officeCode: "10311209103",
  esignCertificateOnCompletion: true
};

export const createTransactionDraft: CreateTransactionDraft = {
  transactionType: "Residential resale",
  address: "100-50 63rd Rd",
  city: "Flushing",
  state: "NY",
  zipCode: "11374",
  contractDate: "2026-03-10",
  salePrice: "1260000",
  buyerExpirationDate: "",
  listingDate: "",
  listingExpirationDate: "",
  closingDate: "2026-05-30",
  agentName: "Jane Wu",
  teamLeader: "Simon Park",
  licensedAgentName: "Jane Wu",
  companyReferral: "Yes",
  companyReferralEmployeeName: "Acre小助手",
  brokerageName: "Acre NY Realty Inc",
  sourceNotes: "客服推单场景示例。广州客服或美国客服场景见下方规则说明。",
  commissionPercent: "3.0",
  referralPercent: "20",
  participants: [
    { id: "p-agent", name: "Jane Wu", role: "Primary agent", splitLabel: "80%" },
    { id: "p-referral", name: "Acre小助手", role: "Company referral", splitLabel: "20%", notes: "客服推单默认 20%" }
  ],
  referralRules: [
    "客服推单或代运营成单时，Company Referral 必须选择 Yes。",
    "客服推单时，Company Referral Employee’s Name 填客服姓名或客服号名称，例如 暖宝 / 小简 / Acre小助手 / Acre小秘书。",
    "代运营成单时，Company Referral Employee’s Name 填 代运营 - 账号名称，例如 代运营 - 查理NY地产资讯。",
    "广州客服推单或代运营成单，需要额外添加 Guangzhou Huihe。",
    "美国客服推单，需要额外添加 Feitong Zhao。",
    "客服推单默认 20%，代运营成单默认 10%。"
  ]
};

export function getCurrentOrganization() {
  return organization;
}

export function getOffices() {
  return offices;
}

export function getMembers(role?: UserRole) {
  return role ? members.filter((member) => member.role === role) : members;
}

export function listListings(audience: "agent" | "office" = "agent") {
  return audience === "agent" ? listings.filter((listing) => listing.status !== "Pending review") : listings;
}

export function listClients() {
  return clients;
}

export function listNotifications() {
  return notifications;
}

export function listResources() {
  return resources;
}

export function listVendors() {
  return vendors;
}

export function listEvents() {
  return events;
}

export function listTransactions() {
  return transactions;
}

export function getCompanySettings() {
  return companySettings;
}

export function getCreateTransactionDraft() {
  return createTransactionDraft;
}

export function getPipelineBuckets(): PipelineBucket[] {
  const statuses: TransactionStatus[] = ["Opportunity", "Active", "Pending", "Closed", "Cancelled"];

  return statuses.map((status) => {
    const bucketTransactions = transactions.filter((transaction) => transaction.status === status);
    const bucketVolume = bucketTransactions.reduce((total, transaction) => total + transaction.volume, 0);

    return {
      status,
      count: bucketTransactions.length,
      volumeLabel:
        bucketVolume > 0
          ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(bucketVolume)
          : "$0",
      transactions: bucketTransactions
    };
  });
}

// Legacy demo-only snapshot kept for older agent mock routes and historical references.
export function getAgentDashboardSnapshot(userId = "member-jane"): AgentDashboardSnapshot {
  const user = members.find((member) => member.id === userId) ?? members[0];

  return {
    organization,
    user,
    tasks: agentTasks,
    listings: listListings("agent").slice(0, 3),
    notifications,
    resources: resources.slice(0, 2),
    metrics: [
      { label: "Clients to touch", value: "7", trend: "3 follow-ups due by end of day" },
      { label: "Tracked links today", value: "138", trend: "Riverline West is leading click volume" },
      { label: "Upcoming events", value: "2", trend: "Both RSVP windows close this week" },
      { label: "AI drafts generated", value: "11", trend: "Listing writer usage is up 22% this week" }
    ]
  };
}

export function getOfficeDashboardSnapshot(userId = "member-simon"): OfficeDashboardSnapshot {
  const manager = members.find((member) => member.id === userId) ?? members[1];

  return {
    organization,
    offices,
    manager,
    metrics: [
      { label: "Tracked Link Clicks", value: "4,280", trend: "+18% week over week" },
      { label: "Listings Shared", value: "612", trend: "LIC units dominate the top 10" },
      { label: "Event RSVP", value: "84", trend: "Workshop registration closes in 2 days" },
      { label: "AI Parsing Queue", value: "9", trend: "3 status changes need review" }
    ],
    listings: listListings("office"),
    events,
    resources,
    workflowNotes: officeWorkflowNotes,
    goal: {
      target: "$10,000",
      progressPercent: 0,
      currentValue: "$0",
      timeLeft: "11m · 15d"
    },
    weeklyUpdates: officeWeeklyUpdates,
    usefulLinks: officeUsefulLinks,
    trainingLinks: officeTrainingLinks,
    recentTransactions
  };
}

export function getApiCatalog() {
  return [
    "/api/health",
    "/api/db/seeded-context",
    "/api/agent/dashboard",
    "/api/office/dashboard",
    "/api/listings",
    "/api/clients",
    "/api/events",
    "/api/resources"
  ];
}
