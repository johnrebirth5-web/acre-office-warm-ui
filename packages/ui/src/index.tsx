import type { CSSProperties, ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { HorizontalScrollArea } from "./horizontal-scroll-area";

export { HorizontalScrollArea } from "./horizontal-scroll-area";

type ClassValue = string | false | null | undefined;

function cx(...values: ClassValue[]) {
  return values.filter(Boolean).join(" ");
}

type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

function buttonClassName(variant: ButtonVariant, size: ButtonSize, className?: string) {
  return cx("office-button", `office-button-${variant}`, size === "sm" && "office-button-sm", className);
}

export function Badge(props: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  const tone = props.tone ?? "neutral";
  return <span className={cx("office-badge", `office-badge-${tone}`, props.className)}>{props.children}</span>;
}

export function StatusBadge(props: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  const tone = props.tone ?? "neutral";
  return <span className={cx("office-status-badge", `office-status-badge-${tone}`, props.className)}>{props.children}</span>;
}

export function Button(props: ComponentPropsWithoutRef<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  const { variant = "primary", size = "md", className, type = "button", ...rest } = props;
  return <button className={buttonClassName(variant, size, className)} type={type} {...rest} />;
}

export function PageShell(props: { className?: string; children: ReactNode }) {
  return <div className={cx("office-page-shell", props.className)}>{props.children}</div>;
}

export function PageHeader(props: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("office-page-header", props.className)}>
      <div className="office-page-heading">
        {props.eyebrow ? <span className="office-eyebrow">{props.eyebrow}</span> : null}
        <h2>{props.title}</h2>
        {props.description ? <p>{props.description}</p> : null}
      </div>
      {props.actions ? <div className="office-page-actions">{props.actions}</div> : null}
    </section>
  );
}

export function PageHeaderSummary(props: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cx("office-page-actions office-list-page-header-actions", props.className)}>{props.children}</div>;
}

export function OfficeListPageSummary(props: {
  className?: string;
  children: ReactNode;
}) {
  return <PageHeaderSummary className={cx("office-list-page-summary", props.className)}>{props.children}</PageHeaderSummary>;
}

export function SectionHeader(props: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cx("office-section-head", props.className)}>
      <div className="office-section-copy">
        <h3>{props.title}</h3>
        {props.subtitle ? <p>{props.subtitle}</p> : null}
      </div>
      {props.actions ? <div className="office-section-actions">{props.actions}</div> : null}
    </header>
  );
}

export function SectionCard(props: {
  id?: string;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cx("office-section-card", props.className)} id={props.id}>
      {props.title || props.actions ? (
        <SectionHeader actions={props.actions} subtitle={props.subtitle} title={props.title ?? ""} />
      ) : null}
      <div className="office-section-body">{props.children}</div>
    </section>
  );
}

export function ListPageSection(props: {
  id?: string;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return <SectionCard {...props} className={cx("office-list-card", props.className)} />;
}

export function ListPageTableSection(props: {
  id?: string;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  filters?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <ListPageSection {...props} className={cx("office-list-page-table-section", props.className)}>
      {props.filters}
      {props.children}
      {props.footer}
    </ListPageSection>
  );
}

export function OfficeListPage(props: {
  className?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  summary?: ReactNode;
  summaryClassName?: string;
  sectionId?: string;
  sectionTitle?: string;
  sectionSubtitle?: string;
  sectionActions?: ReactNode;
  sectionClassName?: string;
  filters?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <PageShell className={cx("office-list-page", props.className)}>
      <PageHeader
        actions={props.summary ? <OfficeListPageSummary className={props.summaryClassName}>{props.summary}</OfficeListPageSummary> : null}
        description={props.description}
        eyebrow={props.eyebrow}
        title={props.title}
      />

      <ListPageTableSection
        actions={props.sectionActions}
        className={props.sectionClassName}
        filters={props.filters}
        footer={props.footer}
        id={props.sectionId}
        subtitle={props.sectionSubtitle}
        title={props.sectionTitle}
      >
        {props.children}
      </ListPageTableSection>
    </PageShell>
  );
}

export function ListPageStack(props: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cx("office-list-page-stack", props.className)}>{props.children}</div>;
}

export function ListPageSplit(props: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cx("office-list-page-split", props.className)}>{props.children}</div>;
}

export function Panel(props: { title?: string; subtitle?: string; actions?: ReactNode; className?: string; children: ReactNode }) {
  return <SectionCard {...props} />;
}

export function DetailSection(props: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cx("office-detail-section", props.className)}>
      <SectionHeader actions={props.actions} subtitle={props.subtitle} title={props.title} />
      <div className="office-detail-section-body">{props.children}</div>
    </section>
  );
}

export function FormSection(props: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cx("office-form-section", props.className)}>
      {props.title || props.actions ? <SectionHeader actions={props.actions} subtitle={props.subtitle} title={props.title ?? ""} /> : null}
      <div className="office-form-section-body">{props.children}</div>
    </section>
  );
}

export function FilterBar<T extends "div" | "form" = "div">(
  props: {
    as?: T;
    className?: string;
    children: ReactNode;
  } & Omit<ComponentPropsWithoutRef<T>, "className" | "children" | "as">
) {
  const { as, className, children, ...rest } = props;
  const Component = (as ?? "div") as ElementType;

  return (
    <Component className={cx("office-filter-bar", className)} {...rest}>
      {children}
    </Component>
  );
}

export function ListPageFilters<T extends "div" | "form" = "div">(
  props: {
    as?: T;
    className?: string;
    children: ReactNode;
  } & Omit<ComponentPropsWithoutRef<T>, "className" | "children" | "as">
) {
  const { as, className, children, ...rest } = props;
  const Component = (as ?? "div") as ElementType;

  return (
    <Component className={cx("office-filter-bar", "office-list-filters", className)} {...rest}>
      {children}
    </Component>
  );
}

export function FilterField(props: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cx("office-filter-field", props.className)}>
      <span>{props.label}</span>
      {props.children}
    </label>
  );
}

export function StatCard(props: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "accent";
  className?: string;
}) {
  return (
    <article className={cx("office-stat-card", props.tone === "accent" && "office-stat-card-accent", props.className)}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
      {props.hint ? <p>{props.hint}</p> : null}
    </article>
  );
}

export function SummaryChip(props: {
  label: string;
  value: ReactNode;
  tone?: "default" | "accent";
  className?: string;
}) {
  return (
    <article className={cx("office-summary-chip", props.tone === "accent" && "office-summary-chip-accent", props.className)}>
      <strong>{props.value}</strong>
      <span>{props.label}</span>
    </article>
  );
}

export function ListPageStatsGrid(props: {
  className?: string;
  children: ReactNode;
}) {
  return <section className={cx("office-list-page-stats", props.className)}>{props.children}</section>;
}

export function ListPageFooter(props: {
  summary: ReactNode;
  controls?: ReactNode;
  className?: string;
}) {
  return (
    <footer className={cx("office-list-footer", props.className)}>
      <span>{props.summary}</span>
      {props.controls ? <div className="office-list-footer-controls">{props.controls}</div> : null}
    </footer>
  );
}

export function DataTable(props: { className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <HorizontalScrollArea>
      <div className={cx("office-data-table", props.className)} role="table" style={props.style}>
        {props.children}
      </div>
    </HorizontalScrollArea>
  );
}

export function DataTableHeader(props: { className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <div className={cx("office-data-table-head", props.className)} role="row" style={props.style}>
      {props.children}
    </div>
  );
}

export function DataTableBody(props: { className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <div className={cx("office-data-table-body", props.className)} role="rowgroup" style={props.style}>
      {props.children}
    </div>
  );
}

export function DataTableRow(props: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div className={cx("office-data-table-row", props.className)} role="row" style={props.style}>
      {props.children}
    </div>
  );
}

export function FormField(props: {
  label: string;
  helper?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cx("office-form-field", props.className)}>
      <span>{props.label}</span>
      {props.children}
      {props.helper ? <small>{props.helper}</small> : null}
    </label>
  );
}

export function TextInput(props: ComponentPropsWithoutRef<"input">) {
  const { className, ...rest } = props;
  return <input className={cx("office-input", className)} {...rest} />;
}

export function SelectInput(props: ComponentPropsWithoutRef<"select">) {
  const { className, children, ...rest } = props;
  return (
    <select className={cx("office-select", className)} {...rest}>
      {children}
    </select>
  );
}

export function TextareaInput(props: ComponentPropsWithoutRef<"textarea">) {
  const { className, ...rest } = props;
  return <textarea className={cx("office-textarea", className)} {...rest} />;
}

export function CheckboxField(props: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cx("office-checkbox-field", props.className)}>
      {props.children}
      <span>{props.label}</span>
    </label>
  );
}

export function EmptyState(props: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("office-empty-state", props.className)}>
      <strong>{props.title}</strong>
      {props.description ? <p>{props.description}</p> : null}
      {props.action ? <div className="office-empty-state-actions">{props.action}</div> : null}
    </div>
  );
}

export function SecondaryMetaList(props: {
  items: Array<{ label: string; value: ReactNode }>;
  className?: string;
}) {
  return (
    <dl className={cx("office-secondary-meta-list", props.className)}>
      {props.items.map((item) => (
        <div className="office-secondary-meta-row" key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
