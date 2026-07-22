/*
 * Records-portal integration — the SINGLE place admin-log entries leave the hub.
 *
 * The plan: admin-log entries are written in the hub (instead of a department
 * Discord channel) and must land in the EXISTING Records-portal database,
 * attached to the subject member so the log shows up on that person's background.
 * POST /api/logs (routes/logs.js) validates an entry, stamps who logged it and
 * which department server-side, then hands it to forwardLog() below.
 *
 * TODO: implement forwardLog against the Records DB. Everything you need is on
 * `entry` (shape documented in docs/admin-logs-migration.md). The link to a
 * member's background is entry.subject.discordId. Keep it non-throwing — a records
 * outage must never block logging in the hub (the route already responds ok).
 */

// eslint-disable-next-line no-unused-vars
export async function forwardLog(departmentId, entry) {
  // Placeholder until wired. Example of what belongs here (your DB / API call):
  //
  //   await recordsDb.query(
  //     `INSERT INTO member_background
  //        (discord_id, department, category, book, logged_by, logged_at, payload)
  //      VALUES (?, ?, ?, ?, ?, ?, ?)`,
  //     [ entry.subject.discordId, departmentId, entry.type, entry.bookName,
  //       entry.by.discordId, entry.at, JSON.stringify(entry) ]
  //   );
  //   return { forwarded: true };
  //
  return { forwarded: false, reason: "records-portal not configured" };
}
