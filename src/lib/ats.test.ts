import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeEntities, fetchBoard, isForwardDeployedEngineer, isInvestorBoard, parseBoardUrl, splitPlaces } from "./ats.ts";

test("keeps forward deployed engineering titles", () => {
  for (const t of [
    "Forward Deployed Engineer",
    "Forward-Deployed Software Engineer - NYC",
    "Manager, Forward Deployed Engineering",
    "AI Engineer - FDE (Forward Deployed Engineer)",
    "Member of Technical Staff - Atlas FDE",
    "Forward Deployed Builder",
    "Forward Deployed Data Scientist",
    "Forward Deployed Research Scientist",
    "Forward Deployed Architect",
    "Forward Deployed Strategist",
    "Forward Deployed Software Engineer (Post-Sales)",
    "Forward—Deployed Software Engineer",
    "Forward\u00a0Deployed Software Engineer",
    "Forward&#x2011;Deployed Software Engineer",
    "Ｆｏｒｗａｒｄ Ｄｅｐｌｏｙｅｄ Ｓｏｆｔｗａｒｅ Ｅｎｇｉｎｅｅｒ",
  ]) assert.ok(isForwardDeployedEngineer(t), t);
});

test("keeps other names for the deployed engineer role", () => {
  for (const t of [
    "Deployed Engineer - Europe",
    "Partner Deployed Engineer - APAC",
    "Delta Engineer",
    "Forward Deployed AI Engineer",
    "Forward Deployed ML Engineer",
    "Forward Deployed Research Engineer",
    "AI Deployment Engineer",
    "AI Implementation Engineer",
    "AI Integration Engineer",
    "AI Field Engineer",
    "Customer AI Engineer",
    "Agent Deployment Engineer",
    "Applied Research Engineer, Customer Facing",
    "Deployment Strategist",
    "Deployed Architect, Professional Services",
    "Customer Deployment Engineer",
    "Deployment Success Engineer",
    "Agent Deployment Architect",
    "「デプロイメント・ストラテジスト（日本）」",
    "Founding Program Lead AI Deployment Strategist, South Korea",
  ]) assert.ok(isForwardDeployedEngineer(t), t);
});

test("drops non-engineering forward deployed titles", () => {
  for (const t of [
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
    "Forward Deployed Finance Engineer",
    "Forward Deployed Hardware Integration Engineer",
    "Hardware Engineer - Forward Deployed",
    "Electrical Engineer - Forward Deployed",
    "Mechanical Engineer - Forward Deployed",
    "Forward Deployed Build Engineer",
    "Chief of Staff, FDE",
    "Forward Deployed Engineer, Internal Tools",
    "Forward Deployed Engineering Recruiter",
    "Applied AI Engineering, Marketing",
    "AI Deployment Sales Engineer",
    "NotFDE Software Engineer",
  ]) assert.ok(!isForwardDeployedEngineer(t), t);
});

test("requires customer-delivery context for ambiguous AI aliases", () => {
  for (const title of ["Applied AI Engineer", "Applied AI Architect", "Applied AI Specialist", "Embedded AI Engineer"]) {
    assert.equal(isForwardDeployedEngineer(title), false, title);
    assert.equal(isForwardDeployedEngineer(title, "Build internal agent infrastructure with our product team."), false, title);
    assert.equal(isForwardDeployedEngineer(title, "You will work directly with customers to deploy production AI systems."), true, title);
    assert.equal(isForwardDeployedEngineer(title, "<h3>Responsibilities</h3>Build the core retrieval platform.<h3>Qualifications</h3>Experience working directly with customers and as a forward-deployed engineer."), false, title);
    assert.equal(isForwardDeployedEngineer(title, "You will be a pre-sales architect helping customers build AI prototypes."), false, title);
  }
  assert.equal(isForwardDeployedEngineer("Embedded AI Engineer – Android Automotive (On-Device Intelligence)", "Work directly with customers."), false);
});

test("retains customer and research-partner delivery responsibilities", () => {
  for (const description of [
    "<p>You'll advise and embed in partners' teams, building alongside their engineers.</p>",
    "<p>Work with labs to automate experiments end-to-end, from advising to writing production code.</p>",
    "<p>Work with research partners on molecular design, from advising to writing production code.</p>",
    "<p>Act as the technical point of contact for clients on their production AI systems.</p>",
    "<p>Act as the senior technical partner to client leadership on AI strategy.</p>",
    "Work directly with customers to gather requirements and improve their experience.",
  ]) assert.equal(isForwardDeployedEngineer("Applied AI Engineer", description), true, description);
});

test("deployment alone does not make applied research customer-facing", () => {
  for (const title of ["Applied Research Engineer, Deployment", "Applied Research Engineer, Model Deployment"]) {
    assert.equal(isForwardDeployedEngineer(title, "Deploy our internal research models."), false, title);
    assert.equal(isForwardDeployedEngineer(title, "As a Forward-Deployed Engineer, you own customer integrations."), true, title);
  }
  assert.equal(isForwardDeployedEngineer("Applied Research Engineer, Customer Deployments"), true);
});

test("keeps explicit current FDE evidence when the work improves customer experience", () => {
  for (const title of ["Applied AI Engineer", "Senior AI Engineer"]) {
    assert.equal(isForwardDeployedEngineer(title, "As a Forward-Deployed Engineer, you will improve the customer experience."), true, title);
    assert.equal(isForwardDeployedEngineer(title, "As a Forward-Deployed Engineer, you will improve customer experience with our product."), true, title);
  }
});

test("distinguishes current FDE role labels from prior FDE experience", () => {
  for (const title of ["Senior Platform Engineer", "Applied AI Engineer"]) {
    assert.equal(isForwardDeployedEngineer(title, "<p>Role:</p><p>Forward Deployed Engineering</p>"), true, title);
    assert.equal(isForwardDeployedEngineer(title, "<p><em>AI Engineering | Forward Deployed Engineering</em></p>"), true, title);
    assert.equal(isForwardDeployedEngineer(title, "About the role: Forward Deployed Engineering."), true, title);
    assert.equal(isForwardDeployedEngineer(title, "You will act as a Forward-Deployed Engineer, owning deployments."), true, title);
    assert.equal(isForwardDeployedEngineer(title, "As a Forward-Deployed Engineer, draw on your prior experience to own deployments."), true, title);
    assert.equal(isForwardDeployedEngineer(title, "<p>Build our internal platform.</p><p>We seek candidates with experience as a forward-deployed engineer.</p>"), false, title);
    assert.equal(isForwardDeployedEngineer(title, "In your previous role as a Forward-Deployed Engineer, you built integrations."), false, title);
    assert.equal(isForwardDeployedEngineer(title, "In your prior role as a Forward-Deployed Engineer, you built integrations."), false, title);
  }
});

test("ignores qualification-only customer experience under paragraph headings or plain paragraphs", () => {
  const role = "<p>Build our internal AI platform.</p>";
  for (const qualifications of [
    "<p>Qualifications</p><p>Experience working directly with customers.</p>",
    "<p>Experience working directly with customers.</p>",
    "<p>Experience\nworking directly with customers.</p>",
    "<p>We value prior experience\nas a forward-deployed engineer.</p>",
    "<p>We seek candidates with experience working directly with customers.</p>",
    "Requirements: Experience working directly with customers.",
    "<p>Requirements: Experience working directly with customers.</p>",
  ]) assert.equal(isForwardDeployedEngineer("Software Engineer, Applied AI", role + qualifications), false, qualifications);
});

test("only includes generic engineering titles when the current role is explicitly an FDE", () => {
  for (const title of ["Senior Professional Services Engineer", "Technical Deployment Lead", "Software Engineer, Applied AI", "Senior AI Engineer", "Senior Platform Engineer"]) {
    assert.equal(isForwardDeployedEngineer(title, "As a Forward-Deployed Engineer, you will ship customer integrations."), true, title);
    assert.equal(isForwardDeployedEngineer(title, "We value prior experience as a forward-deployed engineer. Build our internal platform."), false, title);
  }
  assert.equal(isForwardDeployedEngineer("Technical Deployment Lead", "As a Technical Deployment Lead on the Forward Deployed Engineering team, you own deployments."), true);
});

test("decodes ATS punctuation and numeric entities without failing on invalid code points", () => {
  assert.equal(decodeEntities("Forward&ndash;Deployed &#x65;ngineer &#8212; &#99999999;"), "Forward-Deployed engineer — &#99999999;");
});

test("classifies Lever and listed Ashby descriptions without extra requests", async (t) => {
  const title = "Applied AI Engineer";
  const description = "Work directly with customers to deploy production AI systems.";
  const calls: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("api.lever.co")) return Response.json([
      { id: "external", text: title, hostedUrl: "https://example.com/external", description },
      { id: "internal", text: title, hostedUrl: "https://example.com/internal", description: "Build internal AI systems.", lists: [{ text: "Qualifications", content: "Experience working directly with customers." }] },
    ]);
    return Response.json({ jobs: [
      { id: "external", title, jobUrl: "https://example.com/external", descriptionHtml: description },
      { id: "internal", title, jobUrl: "https://example.com/internal", descriptionHtml: "Build internal AI systems." },
      { id: "hidden", title, jobUrl: "https://example.com/hidden", descriptionHtml: description, isListed: false },
    ] });
  });
  for (const ats of ["lever", "ashby"] as const) {
    const jobs = await fetchBoard({ ats, slug: "acme", name: "Acme" });
    assert.deepEqual(jobs.map((j) => j.id), ["acme/external"]);
    assert.equal(jobs[0].descriptionHtml, description);
  }
  assert.equal(calls.length, 2);
});

test("fetches only ambiguous Greenhouse descriptions with bounded concurrency", async (t) => {
  const company = { ats: "greenhouse", slug: "acme", name: "Acme" } as const;
  const jobs = [
    { id: 1, title: "Forward Deployed Engineer" },
    { id: 2, title: "Software Engineer" },
    ...Array.from({ length: 7 }, (_, i) => ({ id: i + 3, title: "Applied AI Engineer" })),
  ].map((j) => ({ ...j, absolute_url: `https://example.com/${j.id}` }));
  let active = 0;
  let maxActive = 0;
  const details: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith("/jobs")) return Response.json({ jobs });
    const id = url.split("/").at(-1)!;
    details.push(id);
    active++;
    maxActive = Math.max(maxActive, active);
    await new Promise<void>((resolve) => setImmediate(resolve));
    active--;
    return Response.json({ content: Number(id) % 2 ? "Work directly with customers to deploy AI." : "Build internal AI tools." });
  });
  const result = await fetchBoard(company);
  assert.deepEqual(result.map((j) => j.id), ["acme/1", "acme/3", "acme/5", "acme/7", "acme/9"]);
  assert.equal(details.length, 7);
  assert.ok(!details.includes("1") && !details.includes("2"));
  assert.ok(maxActive > 1 && maxActive <= 4);
});

test("a failed Greenhouse detail request does not hide explicit FDE roles", async (t) => {
  const errors = t.mock.method(console, "error", () => {});
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    if (String(input).endsWith("/jobs")) return Response.json({ jobs: [
      { id: 1, title: "Forward Deployed Software Engineer", absolute_url: "https://example.com/1" },
      { id: 2, title: "Applied AI Engineer", absolute_url: "https://example.com/2" },
    ] });
    return new Response("Unavailable", { status: 503 });
  });
  const jobs = await fetchBoard({ ats: "greenhouse", slug: "acme", name: "Acme" });
  assert.deepEqual(jobs.map((j) => j.id), ["acme/1"]);
  assert.equal(errors.mock.callCount(), 1);
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
