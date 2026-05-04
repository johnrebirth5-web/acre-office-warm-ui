import assert from "node:assert/strict";
import test from "node:test";
import { getAppBaseUrl, getPublicAppBaseUrl, getRequestOrigin } from "./request-origin.ts";

test("request origin prefers reverse-proxy headers when present", () => {
  const request = {
    headers: new Headers({
      host: "127.0.0.1:3000",
      "x-forwarded-host": "office.acre.local",
      "x-forwarded-proto": "https"
    }),
    nextUrl: new URL("http://127.0.0.1:3000/login")
  };

  assert.equal(getRequestOrigin(request), "https://office.acre.local");
});

test("request origin falls back to request url host and protocol", () => {
  const request = {
    headers: new Headers(),
    nextUrl: new URL("http://45.55.247.137/login")
  };

  assert.equal(getRequestOrigin(request), "http://45.55.247.137");
});

test("app base url prefers configured public base url", () => {
  const previousBaseUrl = process.env.ACRE_BASE_URL;
  process.env.ACRE_BASE_URL = "https://acresystem.us/";

  try {
    const request = {
      headers: new Headers({
        host: "127.0.0.1:3000"
      }),
      nextUrl: new URL("http://127.0.0.1:3000/login")
    };

    assert.equal(getAppBaseUrl(request), "https://acresystem.us");
  } finally {
    if (previousBaseUrl === undefined) {
      delete process.env.ACRE_BASE_URL;
    } else {
      process.env.ACRE_BASE_URL = previousBaseUrl;
    }
  }
});

test("public app base url defaults to production instead of localhost", () => {
  const previousBaseUrl = process.env.ACRE_BASE_URL;
  delete process.env.ACRE_BASE_URL;

  try {
    assert.equal(getPublicAppBaseUrl(), "https://acresystem.us");
  } finally {
    if (previousBaseUrl !== undefined) {
      process.env.ACRE_BASE_URL = previousBaseUrl;
    }
  }
});

test("public app base url prefers configured public base url", () => {
  const previousBaseUrl = process.env.ACRE_BASE_URL;
  process.env.ACRE_BASE_URL = "https://office.acre.example/";

  try {
    assert.equal(getPublicAppBaseUrl(), "https://office.acre.example");
  } finally {
    if (previousBaseUrl === undefined) {
      delete process.env.ACRE_BASE_URL;
    } else {
      process.env.ACRE_BASE_URL = previousBaseUrl;
    }
  }
});
