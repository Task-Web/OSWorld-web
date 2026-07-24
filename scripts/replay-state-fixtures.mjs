#!/usr/bin/env node

import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hostSuffix = process.env.OSWORLD_HOST_SUFFIX || "localhost";
const scheme = process.env.OSWORLD_SCHEME || "http";
const runId = `${Date.now().toString(36)}-${process.pid}`;

const hosts = {
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

function assertFixturePreserved(actual, expected, location = "state") {
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

  if (location === "overleaf_collab_web/tests/fixtures/task081-state.json.meta.version") {
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

  if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual), `${location} must remain an array`);
    assert.equal(actual.length, expected.length, `${location} array length changed`);
    expected.forEach((value, index) =>
      assertFixturePreserved(actual[index], value, `${location}[${index}]`),
    );
    return;
  }

  if (expected && typeof expected === "object") {
    assert.ok(actual && typeof actual === "object" && !Array.isArray(actual), `${location} must remain an object`);
    for (const [key, value] of Object.entries(expected)) {
      assert.ok(Object.hasOwn(actual, key), `${location}.${key} was removed`);
      assertFixturePreserved(actual[key], value, `${location}.${key}`);
    }
    return;
  }

  assert.deepEqual(actual, expected, `${location} changed`);
}

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${options.method || "GET"} ${url} returned non-JSON ${response.status}: ${text.slice(0, 300)}`);
  }
  assert.equal(response.status, options.expectedStatus || 200, `${options.method || "GET"} ${url}: ${JSON.stringify(body)}`);
  return body;
}

async function replayFixture(site, host, fixturePath, index) {
  const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
  const cookie = `no-client-state-${runId}-${site}-${index}`;
  const endpoint = `${scheme}://${host}.${hostSuffix}/api/state?cookie=${encodeURIComponent(cookie)}`;
  const put = await jsonRequest(endpoint, { method: "PUT", body: JSON.stringify(fixture) });
  assert.equal(put.user_id, cookie, `${fixturePath}: query cookie override was not honored`);
  assertFixturePreserved(put.state, fixture, path.relative(root, fixturePath));

  const get = await jsonRequest(endpoint);
  assert.deepEqual(get, put, `${fixturePath}: GET did not reproduce the exact persisted PUT response`);
  process.stdout.write(`PASS ${path.relative(root, fixturePath)}\n`);
}

let fixtureCount = 0;
for (const [site, host] of Object.entries(hosts)) {
  const directory = path.join(root, "states", site);
  const entries = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort();
  for (const name of entries) {
    await replayFixture(site, host, path.join(directory, name), fixtureCount++);
  }
}

const overleafFixture = path.join(root, "overleaf_collab_web", "tests", "fixtures", "task081-state.json");
await replayFixture("overleaf_collab_web", "overleaf-collab", overleafFixture, fixtureCount++);

assert.equal(fixtureCount, 36, `Expected 36 fixtures, replayed ${fixtureCount}`);
process.stdout.write(`All ${fixtureCount} fixtures passed retained control-plane replay.\n`);
