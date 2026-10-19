const { Op } = require("sequelize");
const {
  sequelize,
  User,
  Post,
  Like,
  Comment,
  Message,
  Connection,
  Notification,
  FirebaseToken,
  SearchHistory,
  EventParticipant,
  OrganizationMember,
  OrganizationFollower,
  UserVerification,
} = require("../models");
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

  const user = await User.findByPk(id);
  if (!user) throw AppError.notFound("User not found");

  const ownsOrganization = await OrganizationMember.findOne({
    where: { user_id: id, role: "owner" },
  });
  if (ownsOrganization) {
    throw AppError.badRequest(
      "Delete your organizations or hand over ownership before deleting your account"
    );
  }

  await sequelize.transaction(async (transaction) => {
    const byUser = { where: { user_id: id }, transaction };
    const posts = await Post.findAll({ where: { user_id: id }, attributes: ["id"], transaction });
    const postIds = posts.map((p) => p.id);

    await Message.destroy({
      where: { [Op.or]: [{ sender_id: id }, { receiver_id: id }] },
      transaction,
    });
    await Connection.destroy({
      where: { [Op.or]: [{ sender_id: id }, { receiver_id: id }] },
      transaction,
    });
    await Like.destroy({
      where: { [Op.or]: [{ user_id: id }, { post_id: postIds }] },
      transaction,
    });
    await Comment.destroy({
      where: { [Op.or]: [{ user_id: id }, { post_id: postIds }] },
      transaction,
    });
    await Post.destroy({ where: { id: postIds }, transaction });
    for (const model of [
      Notification,
      FirebaseToken,
      SearchHistory,
      EventParticipant,
      OrganizationMember,
      OrganizationFollower,
      UserVerification,
    ]) {
      await model.destroy(byUser);
    }
    await User.destroy({ where: { id }, transaction });
  });
}

module.exports = { list, getById, update, remove };
