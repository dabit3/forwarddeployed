import assert from "node:assert/strict";
import { test } from "node:test";
import { discoveryCandidates } from "./discovery.ts";

test("previously rejected boards are not proposed even if search returns them again", () => {
  const postings = [
    { company: "Red Cell Partners", url: "https://job-boards.greenhouse.io/redcellpartners/jobs/123" },
    { company: "StackOne Ltd.", url: "https://jobs.ashbyhq.com/StackOne/456" },
    { company: "STR", url: "https://boards.greenhouse.io/systemstechnologyresearch/jobs/789" },
    { company: "CAIS", url: "https://boards.greenhouse.io/embed/job_app?for=CAIS&token=123" },
    { company: "Lyra Technology Group", url: "https://job-boards.greenhouse.io/lyratechgroup/jobs/456" },
    { company: "Arcade", url: "https://jobs.ashbyhq.com/arcade-ai/789" },
    { company: "Forward Financing", url: "https://jobs.ashbyhq.com/Forward%20Financing/123" },
    { company: "Jobgether", url: "https://jobs.lever.co/jobgether/456" },
  ];

  assert.deepEqual(discoveryCandidates(postings, []), []);
});

test("rejections match exact board identities, not names or slugs on other ATSs", () => {
  assert.deepEqual(
    discoveryCandidates([
      { company: "Arcade", url: "https://jobs.ashbyhq.com/arcade-ai/123" },
      { company: "Arcade Inc.", url: "https://jobs.ashbyhq.com/arcadeai/123" },
      { company: "Another name for Arcade", url: "https://jobs.ashbyhq.com/ArcadeAI/456" },
      { company: "A Different Arcade", url: "https://jobs.lever.co/arcade-ai/123" },
      { company: "Already Listed", url: "https://jobs.lever.co/listed/123" },
    ], [{ ats: "lever", slug: "listed", name: "Already Listed" }]),
    [
      { ats: "ashby", slug: "arcadeai", name: "Arcade" },
      { ats: "lever", slug: "arcade-ai", name: "A Different Arcade" },
    ],
  );
});
