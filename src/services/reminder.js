const { Op } = require("sequelize");
const { Event, EventParticipant, EventReminder } = require("../models");
const logger = require("../utils/logger");
const { notifyUser } = require("./notification");
const preference = require("./preference");

const WINDOW_MS = 24 * 60 * 60 * 1000;

const hoursLabel = (ms) => {
  const hours = Math.max(1, Math.round(ms / (60 * 60 * 1000)));
  return hours === 1 ? "1 hour" : `${hours} hours`;
};

// Sends one reminder per participant for every event starting within the next 24 hours.
// People who switched event reminders off still get a row, so it is never retried.
async function sendDueReminders(now = new Date()) {
  const events = await Event.findAll({
    where: { date_time: { [Op.gt]: now, [Op.lte]: new Date(now.getTime() + WINDOW_MS) } },
  });
  if (!events.length) return 0;

  const participants = await EventParticipant.findAll({
    where: { event_id: events.map((e) => e.id), status: "joined" },
  });
  if (!participants.length) return 0;

  const done = await EventReminder.findAll({
    where: { event_id: events.map((e) => e.id) },
    attributes: ["event_id", "user_id"],
  });
  const handled = new Set(done.map((r) => `${r.event_id}:${r.user_id}`));
  const byId = new Map(events.map((e) => [e.id, e]));

  let sent = 0;
  for (const p of participants) {
    if (handled.has(`${p.event_id}:${p.user_id}`)) continue;

    await EventReminder.create({ event_id: p.event_id, user_id: p.user_id, sent_at: now });
    try {
      if (!(await preference.get(p.user_id)).event_reminders) continue;
      const event = byId.get(p.event_id);
      await notifyUser({
        userId: p.user_id,
        type: "event_reminder",
        title: "Event reminder",
        body: `${event.title} starts in ${hoursLabel(new Date(event.date_time) - now)}.`,
        data: { eventId: event.id },
      });
      sent++;
    } catch (err) {
      logger.warn({ err: err.message, eventId: p.event_id }, "Could not send event reminder");
    }
  }
  return sent;
}

module.exports = { WINDOW_MS, sendDueReminders };
