import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { companies, getCompany, getRoles } from "@/lib/jobs";
import { filterRoles, formatDate, groupByCompany, postingHref, summarizePlaces, type Filters } from "@/lib/roles";

type Search = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s?.trim() || undefined;
}

function companyHref(f: Filters, company: string): string {
  const p = new URLSearchParams({ company });
  if (f.place) p.set("place", f.place);
  if (f.q) p.set("q", f.q);
  return `/?${p}`;
}

function heading(f: Filters): string {
  const company = f.company ? getCompany(f.company)?.name : undefined;
  let h = "Forward Deployed Engineers";
  if (company) h += ` at ${company}`;
  if (f.place === "Remote") h = `Remote ${h}`;
  else if (f.place) h += ` in ${f.place}`;
  return h;
}

export default async function Home({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const filters: Filters = { place: one(sp.place), company: one(sp.company), q: one(sp.q) };
  const { roles } = await getRoles();
  const shown = filterRoles(roles, filters);

  return (
    <>
      <Sidebar roles={roles} companies={companies} filters={filters} />
      <article>
        <header>
          <h2>{heading(filters)}</h2>
          <h3>
            {shown.length} open {shown.length === 1 ? "role" : "roles"}
            {filters.q ? ` matching \u201c${filters.q}\u201d` : ""}
          </h3>
        </header>
        <div className="article-body">
          {shown.length ? (
            groupByCompany(shown).map((g) => (
              <section key={g.slug} className="company">
                <h4>
                  <Link href={companyHref(filters, g.slug)}>{g.name}</Link>
                  <small>{g.roles.length}</small>
                </h4>
                <ul className="roles">
                  {g.roles.map((r) => (
                    <li key={r.key}>
                      <Link href={postingHref(r.postings[0])}>
                        <span>
                          {r.title}
                          {r.places.length ? <span className="meta">{summarizePlaces(r.places)}</span> : null}
                        </span>
                        <span className="time">{formatDate(r.postedAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          ) : (
            <p className="empty">
              No roles match. <Link href="/">Clear filters</Link>
            </p>
          )}
        </div>
        <footer>Sourced from public Greenhouse, Lever and Ashby boards</footer>
      </article>
    </>
  );
}
