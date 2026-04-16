"use client";

const siteVersionLabel = "v1.0";
const siteReleaseStageLabel = "Official";
const siteCopyrightLabel = "© 2021-2026 Acre";

type SiteReleaseBadgeProps = {
  className?: string;
};

export function SiteReleaseBadge({ className = "" }: SiteReleaseBadgeProps) {
  const classes = className ? `site-release-badge ${className}` : "site-release-badge";

  return (
    <footer className={classes}>
      <div className="site-release-badge-header">
        <strong>{siteVersionLabel}</strong>
        <span className="site-release-badge-stage">{siteReleaseStageLabel}</span>
      </div>
      <span className="site-release-badge-copy">{siteCopyrightLabel}</span>
    </footer>
  );
}
