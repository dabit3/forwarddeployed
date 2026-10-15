import Link from "next/link";

export default function NotFound() {
  return (
    <article style={{ position: "static", width: "100%" }}>
      <header>
        <h2>This role has closed</h2>
        <h3>
          It is no longer on the company&rsquo;s job board. <Link href="/">See open roles</Link>
        </h3>
      </header>
    </article>
  );
}
