import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Board from "@/components/Board";
import { companies, getRoles } from "@/lib/jobs";
import { groupByCompany, paginate } from "@/lib/roles";

type Params = Promise<{ n: string }>;

export const revalidate = 3600;

async function pageCount(): Promise<number> {
  return paginate(groupByCompany(await getRoles())).length;
}

export async function generateStaticParams(): Promise<{ n: string }[]> {
  const count = await pageCount();
  return Array.from({ length: Math.max(0, count - 1) }, (_, i) => ({ n: String(i + 2) }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { n } = await params;
  return { title: `Forward Deployed \u00b7 Page ${n}` };
}

export default async function ListPage({ params }: { params: Params }) {
  const { n } = await params;
  const page = Number(n);
  if (page === 1) permanentRedirect("/");
  const roles = await getRoles();
  if (!/^\d+$/.test(n) || page < 1 || page > paginate(groupByCompany(roles)).length) notFound();
  return <Board roles={roles} companies={companies.map(({ slug, name }) => ({ slug, name }))} page={page} />;
}
