const { UserPreference } = require("../models");

const DEFAULTS = { push_enabled: true, event_reminders: true };

const shape = (row) => ({
  push_enabled: row ? Boolean(row.push_enabled) : DEFAULTS.push_enabled,
  event_reminders: row ? Boolean(row.event_reminders) : DEFAULTS.event_reminders,
});

async function get(userId) {
  return shape(await UserPreference.findByPk(userId));
}

async function update(userId, fields) {
  const current = await get(userId);
  const next = { ...current, ...fields };
  await UserPreference.upsert({ user_id: userId, ...next });
  return next;
}

module.exports = { DEFAULTS, get, update };
