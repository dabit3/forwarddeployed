import rejectedBoards from "../../data/rejected-boards.json" with { type: "json" };
import { isInvestorBoard, parseBoardUrl, type Company } from "./ats.ts";

export interface Found {
  company: string;
  url: string;
}

function boardKey({ ats, slug }: { ats: string; slug: string }): string {
  return `${ats}:${slug.toLowerCase()}`;
}

const rejectedKeys = Object.entries(rejectedBoards).flatMap(([ats, boards]) =>
  Object.keys(boards).map((slug) => boardKey({ ats, slug })),
);

export function discoveryCandidates(postings: Found[], existing: Company[]): Company[] {
  const seen = new Set([...rejectedKeys, ...existing.map(boardKey)]);
  const candidates: Company[] = [];

  for (const { company, url } of postings) {
    const board = parseBoardUrl(url);
    if (!board || isInvestorBoard(board.slug) || isInvestorBoard(company)) continue;
    const id = boardKey(board);
    if (seen.has(id)) continue;

    seen.add(id);
    const name = company.replace(/,?\s+(Inc\.?|GmbH|Corporation|Corp\.?|LLC|Ltd\.?)$/i, "").trim();
    candidates.push({ ...board, name });
  }

  return candidates;
}
