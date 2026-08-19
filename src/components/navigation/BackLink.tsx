import Link from "next/link";

interface Props {
  href?: string;
  label?: string;
}

/** The only persistent chrome inside a thing. */
export function BackLink({ href = "/", label = "Back" }: Props) {
  return (
    <Link href={href} className="thing-back">
      <span className="thing-back__arrow">←</span>
      {label}
    </Link>
  );
}
