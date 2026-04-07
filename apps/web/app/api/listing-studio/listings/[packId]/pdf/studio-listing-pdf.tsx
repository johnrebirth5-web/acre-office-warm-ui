import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { StudioListingDetailSnapshot } from "@acre/db";

const styles = StyleSheet.create({
  page: {
    paddingTop: 26,
    paddingRight: 28,
    paddingBottom: 28,
    paddingLeft: 28,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#162433",
    lineHeight: 1.45,
    backgroundColor: "#ffffff",
  },
  header: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#dbe3ee",
  },
  eyebrow: {
    fontSize: 8,
    color: "#52708f",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: {
    fontSize: 21,
    fontWeight: 700,
    marginBottom: 4,
  },
  price: {
    fontSize: 18,
    fontWeight: 700,
    color: "#144a77",
    marginBottom: 4,
  },
  address: {
    color: "#516074",
  },
  heroImage: {
    width: "100%",
    height: 280,
    objectFit: "cover",
    borderRadius: 14,
    marginBottom: 14,
  },
  factGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 16,
  },
  factCard: {
    flexGrow: 1,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#f8fbff",
  },
  factLabel: {
    fontSize: 8,
    color: "#6b7a8b",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  factValue: {
    fontSize: 12,
    fontWeight: 700,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 6,
  },
  paragraph: {
    color: "#425466",
  },
  bullet: {
    marginBottom: 5,
    color: "#425466",
  },
  pillWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  pill: {
    paddingTop: 4,
    paddingRight: 8,
    paddingBottom: 4,
    paddingLeft: 8,
    borderWidth: 1,
    borderColor: "#d5deea",
    borderRadius: 999,
    color: "#425466",
    fontSize: 8,
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  imageCard: {
    width: "48%",
    height: 180,
    objectFit: "cover",
    borderRadius: 12,
  },
  footer: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#dbe3ee",
    color: "#6b7a8b",
    fontSize: 8,
  },
});

export function StudioListingPdfDocument(props: {
  detail: StudioListingDetailSnapshot;
  generatedAtLabel: string;
  heroImageSrc?: string | null;
  galleryImageSrcs?: string[];
}) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Acre Listing Studio</Text>
          <Text style={styles.title}>{props.detail.pack.headline || props.detail.title}</Text>
          <Text style={styles.price}>{props.detail.priceLabel}</Text>
          <Text style={styles.address}>{props.detail.addressLine}</Text>
          {props.detail.locationLine ? (
            <Text style={styles.address}>{props.detail.locationLine}</Text>
          ) : null}
        </View>

        {props.heroImageSrc ? (
          <Image src={props.heroImageSrc} style={styles.heroImage} />
        ) : null}

        <View style={styles.factGrid}>
          {props.detail.facts.slice(0, 4).map((fact) => (
            <View key={fact.label} style={styles.factCard}>
              <Text style={styles.factLabel}>{fact.label}</Text>
              <Text style={styles.factValue}>{fact.value}</Text>
            </View>
          ))}
        </View>

        {props.detail.pack.summary ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Packet summary</Text>
            <Text style={styles.paragraph}>{props.detail.pack.summary}</Text>
          </View>
        ) : null}

        {props.detail.pack.bulletPoints.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Client highlights</Text>
            {props.detail.pack.bulletPoints.map((point) => (
              <Text key={point} style={styles.bullet}>
                • {point}
              </Text>
            ))}
          </View>
        ) : null}

        {props.detail.amenities.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Amenities</Text>
            <View style={styles.pillWrap}>
              {props.detail.amenities.flatMap((section) =>
                section.items.slice(0, 10).map((item) => (
                  <Text key={`${section.title}-${item}`} style={styles.pill}>
                    {item}
                  </Text>
                )),
              )}
            </View>
          </View>
        ) : null}

        {props.detail.transit.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Transit</Text>
            {props.detail.transit.slice(0, 5).map((item) => (
              <Text key={`${item.label}-${item.distanceLabel ?? ""}`} style={styles.bullet}>
                • {item.label}
                {item.distanceLabel ? ` — ${item.distanceLabel}` : ""}
                {item.detail ? ` · ${item.detail}` : ""}
              </Text>
            ))}
          </View>
        ) : null}

        {props.detail.sourceFacts.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Source facts</Text>
            {props.detail.sourceFacts.slice(0, 8).map((item) => (
              <Text key={item.label} style={styles.bullet}>
                • {item.label}: {item.value}
              </Text>
            ))}
          </View>
        ) : null}

        {props.detail.capturedSections.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional details</Text>
            {props.detail.capturedSections.slice(0, 3).map((section) => (
              <View key={section.title} style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 9, fontWeight: 700, marginBottom: 4 }}>
                  {section.title}
                </Text>
                {section.items.slice(0, 5).map((item) => (
                  <Text key={`${section.title}-${item}`} style={styles.bullet}>
                    • {item}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text>Source: {props.detail.sourceSite}</Text>
          <Text>Original listing: {props.detail.sourceUrl}</Text>
          <Text>Generated: {props.generatedAtLabel}</Text>
        </View>
      </Page>

      {props.galleryImageSrcs?.length ? (
        <Page size="LETTER" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.eyebrow}>Acre Listing Studio</Text>
            <Text style={styles.title}>Gallery</Text>
            <Text style={styles.address}>{props.detail.title}</Text>
          </View>
          <View style={styles.imageGrid}>
            {props.galleryImageSrcs.slice(0, 4).map((src, index) => (
              <Image key={`${src}-${index}`} src={src} style={styles.imageCard} />
            ))}
          </View>
          <View style={styles.footer}>
            <Text>{props.detail.pack.contactName}</Text>
            {props.detail.pack.contactPhone ? <Text>{props.detail.pack.contactPhone}</Text> : null}
            {props.detail.pack.contactEmail ? <Text>{props.detail.pack.contactEmail}</Text> : null}
          </View>
        </Page>
      ) : null}
    </Document>
  );
}
