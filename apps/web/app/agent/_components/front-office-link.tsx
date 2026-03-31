import type { ReactNode } from "react";
import Link from "next/link";

export function FrontOfficeLink(props: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const isExternal = props.href.startsWith("http://") || props.href.startsWith("https://") || props.href.startsWith("mailto:") || props.href.startsWith("tel:");

  if (isExternal) {
    return (
      <a className={props.className} href={props.href} rel="noreferrer" target="_blank">
        {props.children}
      </a>
    );
  }

  return (
    <Link className={props.className} href={props.href}>
      {props.children}
    </Link>
  );
}
