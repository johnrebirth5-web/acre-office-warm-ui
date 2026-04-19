export type KpiStripItem = {
  label: string;
  value: string | number;
  tone?: "accent" | "muted";
};

type KpiStripProps = {
  items: KpiStripItem[];
  className?: string;
};

export function KpiStrip({ items, className }: KpiStripProps) {
  return (
    <dl className={["office-kpi-strip", className].filter(Boolean).join(" ")}>
      {items.map((item, index) => (
        <div
          className={[
            "office-kpi-strip-item",
            item.tone ? `office-kpi-strip-item-${item.tone}` : ""
          ]
            .filter(Boolean)
            .join(" ")}
          key={`${item.label}-${index}`}
        >
          <dt className="office-kpi-strip-label">{item.label}</dt>
          <dd className="office-kpi-strip-value">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
