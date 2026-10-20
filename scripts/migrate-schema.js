// One-off, idempotent fixes for tables created from older versions of the models
// (sequelize.sync() never alters existing tables). Run with: node scripts/migrate-schema.js
const db = require("../src/models");

async function columnType(table, column) {
  const [rows] = await db.sequelize.query(`SHOW COLUMNS FROM \`${table}\` LIKE :column`, {
    replacements: { column },
  });
  return rows[0]?.Type?.toLowerCase() ?? null;
}

async function run() {
  const q = (sql) => db.sequelize.query(sql);

  // Messages.read_status was a boolean; the app uses sent | delivered | seen.
  const status = await columnType("Messages", "read_status");
  if (status && status.startsWith("tinyint")) {
    await q("ALTER TABLE `Messages` MODIFY `read_status` VARCHAR(20) NOT NULL DEFAULT 'sent'");
    await q("UPDATE `Messages` SET `read_status` = 'sent' WHERE `read_status` = '0'");
    await q("UPDATE `Messages` SET `read_status` = 'seen' WHERE `read_status` = '1'");
    console.log("Messages.read_status -> VARCHAR (0 => sent, 1 => seen)");
  }

  // EventParticipants.role distinguishes collaborators from regular participants.
  if (!(await columnType("EventParticipants", "role"))) {
    await q(
      "ALTER TABLE `EventParticipants` ADD COLUMN `role` VARCHAR(255) NULL DEFAULT 'attendee'"
    );
    console.log("EventParticipants.role added");
  }

  console.log("Schema is up to date");
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.sequelize.close());
