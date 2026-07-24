#!/usr/bin/env node

import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, request } from "../overleaf_collab_web/node_modules/playwright/index.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hostSuffix = process.env.OSWORLD_HOST_SUFFIX || "localhost";
const scheme = process.env.OSWORLD_SCHEME || "http";
const controlPath = "/api/" + "state";
const runId = `${Date.now().toString(36)}-${process.pid}`;

const hosts = {
  awsconsole_web: "awsconsole",
  budgetwise_web: "budgetwise",
  calendar_web: "calendar",
  careerlink_web: "careerlink",
  cloudcrm_web: "cloudcrm",
  dinogame_web: "dinogame",
  eventix_web: "eventix",
  expenseflow_web: "expenseflow",
  formcraft_web: "formcraft",
  glbviewer_web: "glbviewer",
  insurance_claim_web: "insurance-claim",
  mailhub_web: "mailhub",
  overleaf_collab_web: "overleaf-collab",
  reviewsphere_web: "reviewsphere",
  slidepuzzle_web: "slidepuzzle",
  streamview_web: "streamview",
  teamchat_web: "teamchat",
  travelhub_ad_web: "travelhubpro",
  trippza_web: "trippza",
  vaultbank_web: "vaultbank",
  visaapplication_web: "visaapplication",
  wandb_web: "wandb",
};

const fixtureHosts = {
  budgetwise_web: "budgetwise",
  calendar_web: "calendar",
  careerlink_web: "careerlink",
  cloudcrm_web: "cloudcrm",
  dinogame_web: "dinogame",
  eventix_web: "eventix",
  formcraft_web: "formcraft",
  mailhub_web: "mailhub",
  reviewsphere_web: "reviewsphere",
  streamview_web: "streamview",
  teamchat_web: "teamchat",
  vaultbank_web: "vaultbank",
};

function origin(host) {
  return `${scheme}://${host}.${hostSuffix}`;
}

function assertSubset(actual, expected, location = "state") {
  if (location.endsWith(".meta.updated_at")) {
    assert.equal(typeof actual, "string", `${location} must remain a timestamp string`);
    assert.ok(!Number.isNaN(Date.parse(actual)), `${location} must remain a valid timestamp`);
    return;
  }
  if (location.endsWith(".meta.created_at")) {
    if (location.startsWith("overleaf_collab_web/")) {
      assert.equal(typeof actual, "string", `${location} must remain a timestamp string`);
      assert.ok(!Number.isNaN(Date.parse(actual)), `${location} must remain a valid timestamp`);
      return;
    }
    assert.equal(Date.parse(actual), Date.parse(expected), `${location} changed`);
    return;
  }
  if (location.endsWith(".meta.version")) {
    assert.ok(Number.isInteger(actual) && actual >= expected, `${location} must migrate forward`);
    return;
  }
  if (location === "overleaf_collab_web/tests/fixtures/task081-state.json.meta.type") {
    assert.equal(actual, "task", `${location} must migrate to task state`);
    return;
  }
  if (/^overleaf_collab_web\/tests\/fixtures\/task081-state\.json\.data\.projects\[\d+\]\.comments\[\d+\]\.(?:created_at|updated_at)$/.test(location)) {
    assert.equal(typeof actual, "string", `${location} must remain a timestamp string`);
    assert.ok(!Number.isNaN(Date.parse(actual)), `${location} must remain a valid timestamp`);
    return;
  }
  if (
    location.startsWith("teamchat_web/") &&
    location.endsWith(".note") &&
    expected === null &&
    actual === "Initialized TeamChat mock data"
  ) {
    return;
  }
  if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual), `${location} must remain an array`);
    assert.equal(actual.length, expected.length, `${location} array length changed`);
    expected.forEach((value, index) => assertSubset(actual[index], value, `${location}[${index}]`));
    return;
  }
  if (expected && typeof expected === "object") {
    assert.ok(actual && typeof actual === "object" && !Array.isArray(actual), `${location} must remain an object`);
    for (const [key, value] of Object.entries(expected)) {
      assert.ok(Object.hasOwn(actual, key), `${location}.${key} was removed`);
      assertSubset(actual[key], value, `${location}.${key}`);
    }
    return;
  }
  assert.deepEqual(actual, expected, `${location} changed`);
}

async function apiJson(api, url, options = {}) {
  const response = await api.fetch(url, options);
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${options.method || "GET"} ${url} returned non-JSON ${response.status()}: ${text.slice(0, 300)}`);
  }
  assert.ok(response.ok(), `${options.method || "GET"} ${url}: ${response.status()} ${text.slice(0, 300)}`);
  return body;
}

async function controlJson(api, host, cookie, options = {}) {
  const url = `${origin(host)}${controlPath}?cookie=${encodeURIComponent(cookie)}`;
  return apiJson(api, url, options);
}

async function browserJson(page, pathname, options = {}) {
  return page.evaluate(async ({ pathname, options }) => {
    const response = await fetch(pathname, {
      ...options,
      headers: { "content-type": "application/json", ...(options.headers || {}) },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`${options.method || "GET"} ${pathname}: ${response.status} ${text.slice(0, 300)}`);
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`${pathname} returned non-JSON: ${text.slice(0, 300)}`);
    }
  }, { pathname, options });
}

async function openGuardedPage(browser, host, cookie, run) {
  const siteOrigin = origin(host);
  const context = await browser.newContext();
  await context.addCookies([{ name: "user_id", value: cookie, url: siteOrigin }]);
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const forbiddenRequests = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (req) => {
    const pathname = new URL(req.url()).pathname;
    if (/^\/api\/state(?:\/|$)/.test(pathname)) forbiddenRequests.push(`${req.method()} ${req.url()}`);
  });
  await page.route("**/*", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (/^\/api\/state(?:\/|$)/.test(pathname)) {
      forbiddenRequests.push(`${route.request().method()} ${route.request().url()}`);
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });

  try {
    const response = await page.goto(siteOrigin, { waitUntil: "domcontentloaded", timeout: 45_000 });
    assert.ok(response, `${host}: navigation returned no response`);
    assert.ok(response.status() < 400, `${host}: navigation returned ${response.status()}`);
    await page.waitForTimeout(750);
    const visibleText = (await page.locator("body").innerText()).trim();
    assert.ok(visibleText.length > 0, `${host}: rendered UI is empty`);
    if (run) await run(page);
    await page.waitForTimeout(250);
    assert.deepEqual(forbiddenRequests, [], `${host}: browser requested the control-plane API`);
    assert.deepEqual(pageErrors, [], `${host}: page errors: ${pageErrors.join(" | ")}`);
    assert.deepEqual(consoleErrors, [], `${host}: console errors: ${consoleErrors.join(" | ")}`);
  } finally {
    await context.close();
  }
}

const actionChecks = {
  awsconsole_web: async (page) => {
    await browserJson(page, "/api/aws-console");
    await browserJson(page, "/api/aws-console/actions", { method: "POST", body: { type: "SET_REGION", payload: "us-west-2" } });
  },
  budgetwise_web: async (page) => {
    await browserJson(page, "/api/budgetwise/session");
    await browserJson(page, "/api/budgetwise/cart/plans", { method: "POST", body: { plan_id: "15gb", term: "6", sim_type: "psim" } });
  },
  eventix_web: async (page) => {
    const body = await browserJson(page, "/api/eventix/catalog");
    const concert = body.catalog.concerts.concerts[0];
    const venue = body.catalog.venues.venues.find((item) => item.id === concert?.venueId);
    const section = body.catalog.seatMaps[venue?.seatMapFile]?.sections[0];
    assert.ok(concert && venue && section, "eventix: default catalog is incomplete");
    const selectedSeat = {
      id: `${section.id}_A1`,
      section: section.displayName,
      row: "A",
      seatNumber: 1,
      price: section.priceRange.min,
    };
    await browserJson(page, "/api/eventix/cart", {
      method: "PUT",
      body: {
        concertId: concert.id,
        eventName: concert.eventName,
        venueName: `${venue.name}, ${venue.city}, ${venue.state}`,
        eventDateTime: `${concert.date} ${concert.time}`,
        quantity: 1,
        selectedSeats: [selectedSeat],
        totalPrice: selectedSeat.price,
        updatedAtUTC: "2026-07-24T00:00:00Z",
      },
    });
  },
  expenseflow_web: async (page) => {
    await browserJson(page, "/api/expenseflow/workspace");
    await browserJson(page, "/api/expenseflow/drafts/preferences", { method: "PATCH", body: { cashExpensesDirty: true } });
  },
  formcraft_web: async (page) => {
    await browserJson(page, "/api/forms/current");
    await browserJson(page, "/api/forms/current/submissions", {
      method: "POST",
      body: {
        submitted_at: "2026-07-24T00:00:00Z",
        answers: [
          { field_id: "full_name", value: "Ada Lovelace" },
          { field_id: "email", value: "ada@example.com" },
          { field_id: "team_size", value: "1-5" },
          { field_id: "target_date", value: "2026-08-01" },
          { field_id: "focus", value: "Research" },
        ],
      },
    });
  },
  calendar_web: async (page) => {
    await browserJson(page, "/api/calendar");
    await browserJson(page, "/api/calendar/actions", { method: "POST", body: { type: "TOGGLE_CALENDAR", payload: "c1" } });
  },
  careerlink_web: async (page) => {
    await browserJson(page, "/api/linkedin/state");
    await browserJson(page, "/api/linkedin/company/profile", { method: "POST", body: { overview: "Browser contract profile" } });
  },
  cloudcrm_web: async (page) => {
    await browserJson(page, "/api/crm/workspace");
    await browserJson(page, "/api/crm/leads", { method: "POST", body: { firstName: "Ada", lastName: "Lovelace", company: "Analytical" } });
  },
  dinogame_web: async (page) => {
    await browserJson(page, "/api/game");
    await browserJson(page, "/api/game/results", { method: "POST", body: { score: 17, obstacles_passed: 2 } });
  },
  glbviewer_web: async (page) => {
    await browserJson(page, "/api/viewer");
    await browserJson(page, "/api/integrity/developer-tools", { method: "POST", body: {} });
  },
  insurance_claim_web: async (page) => {
    await browserJson(page, "/api/claims/workspace");
    await browserJson(page, "/api/claims/draft", { method: "PUT", body: { formData: { "insured-name": "Ada" }, uploadedFiles: [], currentStep: 2 } });
  },
  mailhub_web: async (page) => {
    const body = await browserJson(page, "/api/mail/state");
    const emailId = body.mail.emails[0]?.id;
    assert.ok(emailId, "mailhub: no email available");
    await browserJson(page, `/api/mail/email/${encodeURIComponent(emailId)}`, { method: "PATCH", body: { updates: { starred: true } } });
  },
  overleaf_collab_web: async (page) => {
    await browserJson(page, "/api/projects");
    await browserJson(page, "/api/integrity/developer-tools", { method: "POST", body: {} });
  },
  reviewsphere_web: async (page) => {
    const body = await browserJson(page, "/api/reviewsphere");
    const forumId = Object.keys(body.reviewsphere.notes)[0];
    assert.ok(forumId, "reviewsphere: no forum note available");
    await browserJson(page, "/api/reviewsphere/actions", { method: "POST", body: { type: "ADD_COMMENT", payload: { forum_id: forumId, comment: "Browser contract comment" } } });
  },
  slidepuzzle_web: async (page) => {
    await browserJson(page, "/api/puzzles");
    const started = await browserJson(page, "/api/puzzles/jigsaw/sessions", { method: "POST", body: {} });
    const piece = started.puzzle_state.pieces[0];
    assert.ok(piece, "slidepuzzle: no puzzle piece available");
    await browserJson(page, "/api/puzzles/jigsaw/moves", { method: "POST", body: { piece_id: piece.id, x: piece.x, y: piece.y } });
  },
  streamview_web: async (page) => {
    const body = await browserJson(page, "/api/streamview/bootstrap");
    const videoId = body.data.videos[0]?.id || body.data.videos[0]?.videoId;
    assert.ok(videoId, "streamview: no video available");
    await browserJson(page, `/api/streamview/videos/${encodeURIComponent(videoId)}`, { method: "PATCH", body: { title: "Browser contract video" } });
  },
  teamchat_web: async (page) => {
    await browserJson(page, "/api/teamchat/workspace");
    await browserJson(page, "/api/teamchat/message", { method: "POST", body: { conversation_id: "general", conversation_type: "channel", content: "Browser contract message" } });
  },
  travelhub_ad_web: async (page) => {
    await browserJson(page, "/api/travel-workspace");
    await browserJson(page, "/api/account/session", { method: "POST", body: { email: "ada@example.com", provider: "email" } });
  },
  trippza_web: async (page) => {
    await browserJson(page, "/api/cities");
    await browserJson(page, "/api/passengers", { method: "POST", body: { firstName: "Ada", lastName: "Lovelace", idType: "Passport", idNumber: "PW-001", country: "UK", expiry: "2030-01-01", dob: "1990-01-01" } });
  },
  vaultbank_web: async (page) => {
    await browserJson(page, "/api/vaultbank/dashboard");
    await browserJson(page, "/api/vaultbank/profile", { method: "PATCH", body: { first_name: "Ada" } });
  },
  visaapplication_web: async (page) => {
    await browserJson(page, "/api/visa-application");
    await browserJson(page, "/api/visa-application/preferences", { method: "PATCH", body: { location: "TIA" } });
  },
  wandb_web: async (page) => {
    await browserJson(page, "/api/wandb/bootstrap");
    await browserJson(page, "/api/wandb/actions", { method: "POST", body: { type: "MARK_ALL_NOTIFICATIONS_READ" } });
  },
};

const finalStateChecks = {
  awsconsole_web: (data) => assert.equal(data.user.region, "us-west-2"),
  budgetwise_web: (data) => assert.equal(data.budgetwise.cartItems.some((item) => item.plan?.id === "15gb" || item.planId === "15gb"), true),
  calendar_web: (data) => assert.equal(data.calendars.find((item) => item.id === "c1")?.visible, false),
  careerlink_web: (data) => assert.equal(data.linkedin.company.overview, "Browser contract profile"),
  cloudcrm_web: (data) => assert.equal(data.leads.some((item) => item.firstName === "Ada" && item.lastName === "Lovelace"), true),
  dinogame_web: (data) => {
    assert.equal(data.game_results.high_score, 17);
    assert.equal(data.game_results.total_games, 1);
    assert.equal(data.game_results.last_score, 17);
    assert.equal(data.game_results.last_obstacles, 2);
  },
  eventix_web: (data) => {
    assert.equal(data.cart.quantity, 1);
    assert.equal(data.cart.selectedSeats.length, 1);
  },
  expenseflow_web: (data) => assert.equal(data.expenseflow.local_storage.cashExpensesDirty, true),
  formcraft_web: (data) => assert.equal(data.form_response.answers.full_name, "Ada Lovelace"),
  glbviewer_web: (data) => assert.equal(data.developer_tools_open, true),
  insurance_claim_web: (data) => assert.equal(data.current_claim.currentStep, 2),
  mailhub_web: (data) => assert.equal(data.emails.some((item) => item.starred === true), true),
  overleaf_collab_web: (data) => assert.equal(data.developer_tools_open, true),
  reviewsphere_web: (data) => assert.match(JSON.stringify(data.reviews), /Browser contract comment/),
  slidepuzzle_web: (data) => assert.equal(data.puzzle_state.moves, 1),
  streamview_web: (data) => assert.equal(data.videos.some((item) => item.title === "Browser contract video"), true),
  teamchat_web: (data) => assert.equal(data.teamchat.messages.general.some((item) => item.content === "Browser contract message"), true),
  travelhub_ad_web: (data) => assert.equal(data.auth.email, "ada@example.com"),
  trippza_web: (data) => assert.equal(data.user.passengers.some((item) => item.idNumber === "PW-001"), true),
  vaultbank_web: (data) => assert.equal(data.user_profile.first_name, "Ada"),
  visaapplication_web: (data) => assert.equal(data.location, "TIA"),
  wandb_web: (data) => assert.equal(data.notifications.every((item) => item.read === true), true),
};

const api = await request.newContext();
const browser = await chromium.launch({ headless: true });

try {
  let fixtureCount = 0;
  for (const [site, host] of Object.entries(fixtureHosts)) {
    const directory = path.join(root, "states", site);
    const names = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort();
    for (const name of names) {
      const fixture = JSON.parse(await readFile(path.join(directory, name), "utf8"));
      const cookie = `browser-fixture-${runId}-${fixtureCount++}`;
      await controlJson(api, host, cookie, { method: "PUT", data: fixture });
      await openGuardedPage(browser, host, cookie);
      const final = await controlJson(api, host, cookie);
      assertSubset(final.state, fixture, `${site}/${name}`);
      process.stdout.write(`PASS browser fixture ${site}/${name}\n`);
    }
  }

  const overleafFixture = JSON.parse(await readFile(path.join(root, "overleaf_collab_web/tests/fixtures/task081-state.json"), "utf8"));
  const overleafCookie = `browser-fixture-${runId}-${fixtureCount++}`;
  await controlJson(api, "overleaf-collab", overleafCookie, { method: "PUT", data: overleafFixture });
  await openGuardedPage(browser, "overleaf-collab", overleafCookie);
  assertSubset(
    (await controlJson(api, "overleaf-collab", overleafCookie)).state,
    overleafFixture,
    "overleaf_collab_web/tests/fixtures/task081-state.json",
  );
  process.stdout.write("PASS browser fixture overleaf_collab_web/task081-state.json\n");
  assert.equal(fixtureCount, 36, `Expected 36 browser fixtures, exercised ${fixtureCount}`);

  assert.deepEqual(
    Object.keys(actionChecks).sort(),
    Object.keys(hosts).sort(),
    "Every runtime site must define a representative browser read/mutation check",
  );
  assert.deepEqual(
    Object.keys(finalStateChecks).sort(),
    Object.keys(hosts).sort(),
    "Every runtime site must define an evaluator-visible final-state assertion",
  );
  for (const [site, host] of Object.entries(hosts)) {
    const cookie = `browser-action-${runId}-${site.replaceAll("_", "-")}`;
    await controlJson(api, host, cookie, { method: "DELETE" });
    await controlJson(api, host, cookie, { method: "PATCH", data: { data: { evaluator_marker: { keep: true } } } });
    await openGuardedPage(browser, host, cookie, actionChecks[site]);
    const final = await controlJson(api, host, cookie);
    assert.deepEqual(final.state.data.evaluator_marker, { keep: true }, `${site}: feature action removed evaluator state`);
    finalStateChecks[site](final.state.data);
    process.stdout.write(`PASS browser action ${site}\n`);
  }

  process.stdout.write(`All ${fixtureCount} fixtures and ${Object.keys(hosts).length} runtime sites passed browser isolation checks.\n`);
} finally {
  await browser.close();
  await api.dispose();
}
