import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { companies, getPosting, getRoles } from "@/lib/jobs";
import { formatDate, postingHref } from "@/lib/roles";

type Params = Promise<{ company: string; id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { company, id } = await params;
  const detail = await getPosting(decodeURIComponent(company), decodeURIComponent(id)).catch(() => null);
  return { title: detail ? `${detail.job.title} at ${detail.job.company} \u00b7 Forward Deployed` : "Forward Deployed" };
}

export default async function JobPage({ params }: { params: Params }) {
  const { company, id } = await params;
  const [detail, { roles }] = await Promise.all([
    getPosting(decodeURIComponent(company), decodeURIComponent(id)).catch(() => null),
    getRoles(),
  ]);
  if (!detail) notFound();
  const { job, html, siblings } = detail;
  const postings = [job, ...siblings];
  const workplace = job.remote ? (job.places.length > 1 ? "Remote or on-site" : "Remote") : "On-site";

  return (
    <>
      <Sidebar roles={roles} companies={companies} filters={{}} />
      <article>
        <header>
          <Link href="/" className="back">
            All roles
          </Link>
          <h2>{job.title}</h2>
          <h3>{job.company}</h3>
          {job.postedAt && <p>Posted {formatDate(job.postedAt)}</p>}
        </header>
        <div className="article-body">
          <ul className="about-list">
            <li>
              <span>Location</span>
              <span>{job.location || "Unspecified"}</span>
            </li>
            <li>
              <span>Workplace</span>
              <span>{workplace}</span>
            </li>
            {job.team && (
              <li>
                <span>Team</span>
                <span>{job.team}</span>
              </li>
            )}
            {job.compensation && (
              <li>
                <span>Compensation</span>
                <span>{job.compensation}</span>
              </li>
            )}
          </ul>

          <p className="apply">
            <a href={job.url} target="_blank" rel="noopener noreferrer">
              Apply at {job.company}
            </a>
          </p>

          {html ? (
            <div className="description" dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <p className="empty">
              The full description lives on the <a href={job.url}>{job.company} job board</a>.
            </p>
          )}

          {postings.length > 1 && (
            <>
              <hr />
              <ul className="about-list">
                {postings.map((p) => (
                  <li key={p.id}>
                    <span>{p.location || "Unspecified"}</span>
                    {p.id === job.id ? (
                      <span className="dim">This posting</span>
                    ) : (
                      <Link href={postingHref(p)}>View</Link>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <footer>Sourced from public Greenhouse, Lever and Ashby boards</footer>
      </article>
    </>
  );
}
