import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchBoard, isForwardDeployedEngineer, isInvestorBoard, parseBoardUrl, splitPlaces } from "./ats.ts";

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

test("uses the ATS workplace type separately from the location filters", async (t) => {
  const title = "Forward Deployed Engineer";
  const url = "https://example.com/job";
  const lever = { text: title, hostedUrl: url, categories: { location: "United States" } };
  t.mock.method(globalThis, "fetch", async (url: string) => {
    if (url.includes("lever.co")) return Response.json([
      { ...lever, id: "1", workplaceType: "remote" },
      { ...lever, id: "2", workplaceType: "unspecified" },
    ]);
    if (url.includes("ashbyhq.com")) return Response.json({ jobs: [
      { id: "1", title, jobUrl: url, location: "New York", isRemote: true, workplaceType: "Hybrid" },
    ] });
    return Response.json({ jobs: [
      { id: 1, title, absolute_url: url, metadata: [{ name: "Workplace", value: "On-site" }] },
      { id: 2, title, absolute_url: url, metadata: [{ name: "Location Type", value: null }, { name: "Work Type", value: "Remote" }] },
      { id: 3, title, absolute_url: url, metadata: [{ name: "Work Arrangement", value: "Hybrid" }] },
      { id: 4, title, absolute_url: url, metadata: [{ name: "Location Type", value: "Hybrid (Travel-Required)" }] },
    ] });
  });

  const [remote, unspecified] = await fetchBoard({ ats: "lever", slug: "thinkahead", name: "AHEAD" });
  assert.deepEqual(remote.places, ["United States", "Remote"]);
  assert.equal(remote.workplace, "Remote");
  assert.equal(unspecified.workplace, undefined);

  const [hybrid] = await fetchBoard({ ats: "ashby", slug: "example", name: "Example" });
  assert.equal(hybrid.workplace, "Hybrid");
  const greenhouse = await fetchBoard({ ats: "greenhouse", slug: "example", name: "Example" });
  assert.deepEqual(greenhouse.map((j) => j.workplace), ["On-site", "Remote", "Hybrid", "Hybrid (Travel-Required)"]);
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
