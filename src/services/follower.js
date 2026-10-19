const { OrganizationFollower, User } = require("../models");
const AppError = require("../utils/AppError");

async function follow(userId, organizationId) {
  const [follower, created] = await OrganizationFollower.findOrCreate({
    where: { user_id: userId, organization_id: organizationId },
  });
  return { follower, created };
}

async function unfollow(userId, organizationId) {
  const deleted = await OrganizationFollower.destroy({
    where: { user_id: userId, organization_id: organizationId },
  });
  if (!deleted) throw AppError.notFound("Not following organization");
}

async function listForOrganization(organizationId) {
  return OrganizationFollower.findAll({
    where: { organization_id: organizationId },
    include: [{ model: User, attributes: ["id", "name", "profile_pic"] }],
  });
}

async function listUserIds(organizationId) {
  const followers = await OrganizationFollower.findAll({
    where: { organization_id: organizationId },
  });
  return followers.map((f) => f.user_id);
}

module.exports = { follow, unfollow, listForOrganization, listUserIds };
