import { test } from "node:test";
import assert from "node:assert/strict";
import { isForwardDeployedEngineer, isInvestorBoard, parseBoardUrl, splitPlaces } from "./ats.ts";

test("keeps forward deployed engineering titles", () => {
  for (const t of [
    "Forward Deployed Engineer",
    "Forward-Deployed Software Engineer - NYC",
    "Manager, Forward Deployed Engineering",
    "AI Engineer - FDE (Forward Deployed Engineer)",
    "Member of Technical Staff - Atlas FDE",
    "Forward Deployed Builder",
  ]) assert.ok(isForwardDeployedEngineer(t), t);
});

test("keeps other names for the deployed engineer role", () => {
  for (const t of [
    "Deployed Engineer - Europe",
    "Partner Deployed Engineer - APAC",
    "Applied AI Engineer",
    "Delta Engineer",
    "Forward Deployed AI Engineer",
    "Forward Deployed ML Engineer",
    "Forward Deployed Research Engineer",
    "AI Deployment Engineer",
    "AI Implementation Engineer",
    "AI Integration Engineer",
    "Applied AI Architect",
    "Applied AI Specialist",
    "AI Field Engineer",
    "Embedded AI Engineer",
    "Customer AI Engineer",
    "Agent Deployment Engineer",
    "Applied Research Engineer, Customer Facing",
    "Deployment Strategist",
  ]) assert.ok(isForwardDeployedEngineer(t), t);
});

test("drops non-engineering forward deployed titles", () => {
  for (const t of [
    "Forward Deployed Strategist",
    "Applied AI Transformation Manager",
    "Applied Research Engineer",
    "Deployment Engineer",
    "Embedded AI Engineer – Android Automotive (On-Device Intelligence)",
    "Software Engineer, Backend",
    "Recruiter, Forward Deployed Engineering",
    "Account Executive",
    "Technical Program Manager, Forward Deployed Engineering",
    "Sr. Engagement Manager, FDE",
    "Sr. Delivery Partner Manager, FDE",
  ]) assert.ok(!isForwardDeployedEngineer(t), t);
});

test("normalizes places", () => {
  assert.deepEqual(splitPlaces(["San Francisco, CA; New York City, NY"], false), ["San Francisco", "United States", "New York"]);
  assert.deepEqual(splitPlaces(["Remote - US"], false), ["Remote", "United States"]);
  assert.deepEqual(splitPlaces(["London, United Kingdom"], true), ["London", "United Kingdom", "Remote"]);
  assert.deepEqual(splitPlaces(["Maryland; Virginia; Washington, D.C."], false), ["Washington, DC", "United States"]);
  assert.deepEqual(splitPlaces(["US-CA-Menlo Park"], false), ["San Francisco", "United States"]);
  assert.deepEqual(splitPlaces(["Austin"], false), ["Austin", "United States"]);
  assert.deepEqual(splitPlaces(["Munich, Bavaria, Germany"], false), ["Munich", "Germany"]);
  assert.deepEqual(splitPlaces(["Remote - India"], false), ["Remote", "India"]);
  assert.deepEqual(splitPlaces(["Singapore"], false), ["Singapore"]);
  assert.deepEqual(splitPlaces(["Hybrid"], false), []);
});

test("parses board urls", () => {
  assert.deepEqual(parseBoardUrl("https://jobs.ashbyhq.com/openai/abc"), { ats: "ashby", slug: "openai" });
  assert.deepEqual(parseBoardUrl("https://job-boards.greenhouse.io/Anthropic/jobs/1"), { ats: "greenhouse", slug: "anthropic" });
  assert.deepEqual(parseBoardUrl("https://boards.greenhouse.io/embed/job_app?for=vercel&token=1"), { ats: "greenhouse", slug: "vercel" });
  assert.deepEqual(parseBoardUrl("https://jobs.lever.co/palantir/xyz/apply"), { ats: "lever", slug: "palantir" });
  assert.equal(parseBoardUrl("https://example.com/jobs"), null);
});

test("flags venture capital portfolio boards", () => {
  for (const s of ["pear-vc", "Pear VC", "a16z", "accel", "sequoia-capital", "greylock-portfolio", "general-catalyst"]) {
    assert.equal(isInvestorBoard(s), true, s);
  }
  for (const s of ["fundamental", "vercel", "capitalone", "anthropic", "advanced", "indexify"]) {
    assert.equal(isInvestorBoard(s), false, s);
  }
});
