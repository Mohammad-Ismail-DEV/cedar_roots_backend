const { Op } = require("sequelize");
const { User } = require("../models");
const AppError = require("../utils/AppError");
const { getBlob } = require("./imageBlob");

const withBlob = async (user) => ({
  id: user.id,
  name: user.name,
  profile_pic: user.profile_pic,
  profile_pic_blob: await getBlob(user.profile_pic),
});

async function list({ search }) {
  const users = await User.findAll({
    where: search ? { name: { [Op.like]: `%${search}%` } } : undefined,
    attributes: ["id", "name", "email", "profile_pic"],
    limit: search ? 20 : 50,
  });

  return Promise.all(users.map(async (u) => ({ ...(await withBlob(u)), email: u.email })));
}

async function getById(id) {
  const user = await User.findByPk(id, { attributes: ["id", "name", "profile_pic"] });
  if (!user) throw AppError.notFound("User not found");
  return withBlob(user);
}

async function update(actorId, id, fields) {
  if (actorId !== id) throw AppError.forbidden("You can only edit your own profile");

  const [updated] = await User.update({ ...fields, updated_at: new Date() }, { where: { id } });
  if (!updated) throw AppError.notFound("User not found");

  return User.findByPk(id, { attributes: ["id", "name", "profile_pic"] });
}

async function remove(actorId, id) {
  if (actorId !== id) throw AppError.forbidden("You can only delete your own account");

  const deleted = await User.destroy({ where: { id } });
  if (!deleted) throw AppError.notFound("User not found");
}

module.exports = { list, getById, update, remove };
