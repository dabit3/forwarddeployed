import Board from "@/components/Board";
import { companies, getRoles } from "@/lib/jobs";

export const revalidate = 3600;

export default async function Home() {
  const roles = await getRoles();
  return <Board roles={roles} companies={companies.map(({ slug, name }) => ({ slug, name }))} />;
}
