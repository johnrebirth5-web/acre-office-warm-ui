import assert from "node:assert/strict";
import test from "node:test";
import type { SessionMembershipContext } from "@acre/db";
import {
  buildAdminGptContextResponse,
  lookupAdminGptHelp,
  triageAdminGptIssue,
} from "./actions";

function createContext() {
  return {
    accessibleOffices: [
      {
        id: "office_1",
        market: "NY",
        name: "Acre NY",
        slug: "acre-ny",
      },
    ],
    currentCredential: null,
    currentMembership: {
      id: "membership_1",
      permissions: ["ai:use"],
      role: "office_admin",
      status: "active",
      title: "Admin",
    },
    currentOffice: {
      id: "office_1",
      market: "NY",
      name: "Acre NY",
      slug: "acre-ny",
    },
    currentOrganization: {
      id: "org_1",
      name: "Acre",
      slug: "acre",
      timezone: "America/New_York",
    },
    currentUser: {
      email: "admin@acre.test",
      firstName: "Admin",
      id: "user_1",
      lastName: "User",
      locale: "en-US",
      timezone: "America/New_York",
    },
  } as SessionMembershipContext;
}

test("lookupAdminGptHelp returns transaction guidance for 登单 questions", () => {
  const result = lookupAdminGptHelp({
    question: "我要登单，在哪个页面登单，需要什么资料？",
  });

  assert.equal(result.status, "matched");
  assert.equal(result.matches[0].id, "transactions");
  assert.match(result.matches[0].summary, /transaction/i);
});

test("lookupAdminGptHelp refuses code and database requests", () => {
  const result = lookupAdminGptHelp({
    question: "帮我改代码并删除数据库里的旧数据",
  });

  assert.equal(result.status, "outside_scope");
  assert.match(result.answerGuidance, /outside/i);
  assert.equal(result.matches[0].id, "unsupported-code-db");
});

test("triageAdminGptIssue classifies permission errors", () => {
  const result = triageAdminGptIssue({
    currentPage: "/office/settings/users",
    question: "我打开用户页面突然报错，是不是 bug？",
    visibleErrorText: "403 Permission required.",
  });

  assert.equal(result.classification, "permission_or_access");
  assert.match(result.programmerHandoff, /Page: \/office\/settings\/users/);
});

test("triageAdminGptIssue classifies repeated server errors as likely bugs", () => {
  const result = triageAdminGptIssue({
    currentPage: "/office/transactions",
    question: "保存交易以后白屏",
    visibleErrorText: "500 TypeError unexpected null",
  });

  assert.equal(result.classification, "likely_system_bug");
  assert.match(result.programmerHandoff, /Visible error: 500 TypeError unexpected null/);
});

test("buildAdminGptContextResponse does not include business records", () => {
  const response = buildAdminGptContextResponse(createContext());
  const serialized = JSON.stringify(response).toLowerCase();

  assert.equal(response.currentAdmin.role, "office_admin");
  assert.equal(serialized.includes("transactionid"), false);
  assert.equal(serialized.includes("clientid"), false);
  assert.equal(serialized.includes("admin@acre.test"), false);
});
