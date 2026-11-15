export const EXPORT_REMINDER_DAYS = 14

// True when there is data and no export in the last 14 days. If the user never exported,
// the clock starts from the oldest record they created.
export function exportReminderDue(o: { lastExportedAt: string | null; earliestCreatedAt: string | null; hasData: boolean; now: Date }): boolean {
  if (!o.hasData) return false
  const base = o.lastExportedAt ?? o.earliestCreatedAt
  if (!base) return false
  return o.now.getTime() - Date.parse(base) > EXPORT_REMINDER_DAYS * 86400000
}
