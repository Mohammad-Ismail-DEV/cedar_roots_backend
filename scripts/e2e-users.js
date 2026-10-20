// Creates (or removes) verified throwaway users for end-to-end tests of the app.
//   node scripts/e2e-users.js create   -> prints {"password", "users": [{id, email}, ...]}
//   node scripts/e2e-users.js remove 12 13
const bcrypt = require("bcryptjs");
const db = require("../src/models");
const userService = require("../src/services/user");

const PASSWORD = "E2e-Passw0rd!";

async function create(count = 2) {
  const users = [];
  for (let i = 0; i < count; i++) {
    const user = await db.User.create({
      name: `E2E User ${i + 1}`,
      email: `e2e-${Date.now()}-${i}@example.test`,
      password_hash: await bcrypt.hash(PASSWORD, 4),
      created_at: new Date(),
      updated_at: new Date(),
    });
    await db.UserVerification.create({
      user_id: user.id,
      verification_code: "0000",
      expires_at: new Date(Date.now() + 3600000),
      status: "verified",
    });
    users.push({ id: user.id, email: user.email, name: user.name });
  }
  console.log(JSON.stringify({ password: PASSWORD, users }));
}

async function remove(ids) {
  for (const id of ids) await userService.remove(Number(id), Number(id));
  console.log(`removed ${ids.length} user(s)`);
}

const [command, ...args] = process.argv.slice(2);
(command === "create" ? create() : remove(args))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.sequelize.close());
