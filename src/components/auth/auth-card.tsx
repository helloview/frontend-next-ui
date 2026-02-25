import type { Route } from "next";
import Link from "next/link";

type AuthCardProps = {
  title: string;
  description: string;
  children: React.ReactNode;
  footerText?: string;
  footerLinkHref?: Route;
  footerLinkText?: string;
};

export function AuthCard({
  title,
  description,
  children,
  footerText,
  footerLinkHref,
  footerLinkText,
}: AuthCardProps) {
  return (
    <div className="glass w-full max-w-md space-y-6 p-8">
      <div className="space-y-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-ink-500">Helloview Auth</p>
        <h1 className="text-3xl font-semibold tracking-tight text-ink-900">{title}</h1>
        <p className="text-sm text-ink-600">{description}</p>
      </div>

      {children}

      {footerText && footerLinkHref && footerLinkText ? (
        <p className="text-center text-sm text-ink-600">
          {footerText}{" "}
          <Link className="font-medium text-ink-900 underline-offset-4 hover:underline" href={footerLinkHref}>
            {footerLinkText}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
