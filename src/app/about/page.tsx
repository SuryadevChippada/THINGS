import type { Metadata } from "next";
import { BackLink } from "@/components/navigation/BackLink";

export const metadata: Metadata = {
  title: "About — THINGS",
};

const LINKS = [
  {
    label: "GitHub",
    href: "https://github.com/SuryadevChippada",
    path: "M12 .5a12 12 0 0 0-3.79 23.4c.6.1.82-.26.82-.58v-2.2c-3.34.73-4.04-1.4-4.04-1.4-.55-1.4-1.34-1.77-1.34-1.77-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.96 0-1.32.47-2.4 1.24-3.24-.12-.3-.54-1.53.12-3.18 0 0 1-.32 3.3 1.24a11.4 11.4 0 0 1 6 0c2.3-1.56 3.3-1.24 3.3-1.24.66 1.65.24 2.88.12 3.18.77.84 1.24 1.92 1.24 3.24 0 4.63-2.8 5.65-5.48 5.95.43.37.81 1.1.81 2.22v3.3c0 .32.22.69.83.57A12 12 0 0 0 12 .5Z",
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/suryadev-chippada",
    path: "M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05a3.74 3.74 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14Zm1.78 13.02H3.55V9h3.57v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0Z",
  },
  {
    label: "Email",
    href: "mailto:chippadasurya8@gmail.com",
    path: "M1.5 4.5h21v15h-21v-15Zm1.8 1.8v.42l8.7 5.55 8.7-5.55V6.3H3.3Zm17.4 2.6-7.9 5.05a1.5 1.5 0 0 1-1.6 0L3.3 8.9v8.8h17.4V8.9Z",
  },
];

export default function About() {
  return (
    <>
      <BackLink href="/" label="Back" />

      <main className="about">
        <p className="about__label">About</p>

        <p>
          THINGS is a collection of small things I made because I felt like
          making them as i was bored.
        </p>

        <p>
          some are useful.
          <br />
          most aren&rsquo;t.
        </p>

        <p className="about__meta">started 01.03.2025.</p>

        <p className="about__find">find me</p>

        <div className="about__links">
          {LINKS.map((link) => (
            <a
              key={link.label}
              className="about__link"
              href={link.href}
              aria-label={link.label}
              target={link.href.startsWith("mailto:") ? undefined : "_blank"}
              rel="noreferrer"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d={link.path} />
              </svg>
            </a>
          ))}
        </div>
      </main>
    </>
  );
}
