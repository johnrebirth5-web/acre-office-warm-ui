import { SectionCard, SummaryChip } from "@acre/ui";
import { FrontOfficePageTemplate } from "../_components/front-office-page-template";
import styles from "./agent-notifications.module.css";

function LoadingRows(props: { count: number }) {
  return (
    <div className={styles.loadingStack}>
      {Array.from({ length: props.count }).map((_, index) => (
        <div className={styles.loadingRow} key={index}>
          <div className={styles.loadingChips}>
            <div className={styles.loadingChip} />
            <div className={styles.loadingChip} />
            <div className={styles.loadingChip} />
          </div>
          <div
            className={`${styles.loadingLine} ${styles.loadingLineMedium}`}
          />
          <div className={`${styles.loadingLine} ${styles.loadingLineLong}`} />
          <div className={`${styles.loadingLine} ${styles.loadingLineLong}`} />
          <div className={`${styles.loadingLine} ${styles.loadingLineShort}`} />
        </div>
      ))}
    </div>
  );
}

export default function AgentNotificationsLoading() {
  return (
    <FrontOfficePageTemplate
      description="Loading the Front Office activity center, cleanup pressure, reminders, and shared notice lanes."
      eyebrow="Activity"
      main={
        <>
          <SectionCard
            className="office-list-card office-notification-toolbar"
            subtitle="Preparing the current slice, filters, and bulk actions."
            title="Activity lanes & controls"
          >
            <div className={styles.loadingStack}>
              <div className={styles.loadingGrid}>
                {Array.from({ length: 4 }).map((_, index) => (
                  <div className={styles.loadingCard} key={index} />
                ))}
              </div>
              <div className={styles.loadingGrid}>
                {Array.from({ length: 5 }).map((_, index) => (
                  <div className={styles.loadingCard} key={index} />
                ))}
              </div>
              <div className={styles.loadingRow}>
                <div
                  className={`${styles.loadingLine} ${styles.loadingLineShort}`}
                />
                <div
                  className={`${styles.loadingLine} ${styles.loadingLineLong}`}
                />
                <div
                  className={`${styles.loadingLine} ${styles.loadingLineMedium}`}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="Loading the personal cleanup queue."
            title="Personal cleanup"
          >
            <LoadingRows count={3} />
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="Loading appointment reminder pressure."
            title="Appointment reminder pressure"
          >
            <LoadingRows count={2} />
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="Loading general notices."
            title="General notices"
          >
            <LoadingRows count={2} />
          </SectionCard>
        </>
      }
      rail={
        <>
          <SectionCard
            className="office-list-card"
            subtitle="Loading upcoming office events."
            title="Upcoming office events"
          >
            <LoadingRows count={2} />
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="Loading shared activity guidance."
            title="How to use this center"
          >
            <LoadingRows count={3} />
          </SectionCard>
        </>
      }
      summary={
        <>
          <SummaryChip label="Visible route items" value="..." />
          <SummaryChip label="Personal cleanup" tone="accent" value="..." />
          <SummaryChip
            label="Appointment reminders"
            tone="accent"
            value="..."
          />
          <SummaryChip label="General notices" value="..." />
          <SummaryChip label="Upcoming events" value="..." />
        </>
      }
      title="Activity & cleanup"
    />
  );
}
