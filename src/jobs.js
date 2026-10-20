const logger = require("./utils/logger");
const storyService = require("./services/story");
const reminderService = require("./services/reminder");

const TEN_MINUTES = 10 * 60 * 1000;

function every(ms, name, task) {
  const run = () =>
    Promise.resolve()
      .then(task)
      .catch((err) => logger.warn({ err: err.message, job: name }, "Background job failed"));
  run();
  // unref: a pending timer never keeps the process alive on its own.
  setInterval(run, ms).unref();
}

// Removes expired stories and sends "your event starts soon" reminders.
function startJobs() {
  every(TEN_MINUTES, "purge stories", () => storyService.purgeExpired());
  every(TEN_MINUTES, "event reminders", () => reminderService.sendDueReminders());
}

module.exports = { startJobs };
