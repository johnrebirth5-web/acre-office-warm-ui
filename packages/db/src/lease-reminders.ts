export const defaultLeaseReminderLeadDays = 45;

function normalizeDateOnly(value: Date) {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
  );
}

export function buildAutoLeaseReminderAt(
  leaseEndDate: Date | null | undefined,
): Date | null {
  if (!leaseEndDate) {
    return null;
  }

  const reminderAt = new Date(leaseEndDate);
  reminderAt.setDate(reminderAt.getDate() - defaultLeaseReminderLeadDays);

  return normalizeDateOnly(reminderAt);
}

export function resolveLeaseReminderDates(input: {
  leaseEndDate: Date | null;
  leaseReminderAt: Date | null;
}) {
  const normalizedLeaseEndDate = input.leaseEndDate
    ? normalizeDateOnly(input.leaseEndDate)
    : null;

  if (!normalizedLeaseEndDate && !input.leaseReminderAt) {
    return {
      leaseEndDate: null,
      leaseReminderAt: null,
      isAutoScheduled: false,
    };
  }

  const normalizedExplicitReminderAt = input.leaseReminderAt
    ? normalizeDateOnly(input.leaseReminderAt)
    : null;
  const resolvedReminderAt =
    normalizedExplicitReminderAt ?? buildAutoLeaseReminderAt(normalizedLeaseEndDate);

  if (
    normalizedLeaseEndDate &&
    resolvedReminderAt &&
    resolvedReminderAt.getTime() > normalizedLeaseEndDate.getTime()
  ) {
    throw new Error("Lease reminder date cannot be after the lease end date.");
  }

  return {
    leaseEndDate: normalizedLeaseEndDate,
    leaseReminderAt: resolvedReminderAt,
    isAutoScheduled: Boolean(
      normalizedLeaseEndDate &&
        !normalizedExplicitReminderAt &&
        resolvedReminderAt,
    ),
  };
}
