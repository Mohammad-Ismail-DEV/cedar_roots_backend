const { OrganizationMember, User } = require("../models");
const AppError = require("../utils/AppError");

const userInclude = (attributes) => [{ model: User, attributes }];

async function getRole(userId, organizationId) {
  const member = await OrganizationMember.findOne({
    where: { user_id: userId, organization_id: organizationId },
  });
  return member?.role ?? null;
}

async function assertRole(userId, organizationId, allowedRoles) {
  const role = await getRole(userId, organizationId);
  if (!role || !allowedRoles.includes(role)) {
    throw AppError.forbidden("You do not have permission for this organization");
  }
  return role;
}

async function add(actorId, { user_id, organization_id, role }) {
  const actorRole = await assertRole(actorId, organization_id, ["owner", "admin"]);
  if (actorRole === "admin" && role !== "member") {
    throw AppError.forbidden("Only the owner can add admins or owners");
  }

  if (await getRole(user_id, organization_id)) {
    throw AppError.badRequest("User already a member of the organization");
  }
  return OrganizationMember.create({ user_id, organization_id, role });
}

async function listForOrganization(organizationId) {
  return OrganizationMember.findAll({
    where: { organization_id: organizationId },
    include: userInclude(["id", "name", "email", "profile_pic"]),
  });
}

async function get(organizationId, userId) {
  const member = await OrganizationMember.findOne({
    where: { organization_id: organizationId, user_id: userId },
    include: userInclude(["id", "name", "profile_pic"]),
  });
  if (!member) throw AppError.notFound("Not a member");
  return member;
}

async function updateRole(actorId, { organization_id, user_id, role }) {
  await assertRole(actorId, organization_id, ["owner"]);

  const member = await OrganizationMember.findOne({ where: { organization_id, user_id } });
  if (!member) throw AppError.notFound("Member not found");

  member.role = role;
  await member.save();
  return member;
}

async function remove(actorId, { user_id, organization_id }) {
  const targetRole = await getRole(user_id, organization_id);
  if (!targetRole) throw AppError.notFound("Member not found");

  if (actorId === user_id) {
    if (targetRole === "owner") throw AppError.forbidden("The owner cannot leave the organization");
  } else {
    const actorRole = await assertRole(actorId, organization_id, ["owner", "admin"]);
    if (actorRole === "admin" && targetRole !== "member") {
      throw AppError.forbidden("Admins can only remove regular members");
    }
  }

  await OrganizationMember.destroy({ where: { user_id, organization_id } });
}

async function listUserIds(organizationId) {
  const members = await OrganizationMember.findAll({ where: { organization_id: organizationId } });
  return members.map((m) => m.user_id);
}

module.exports = {
  getRole,
  assertRole,
  add,
  listForOrganization,
  get,
  updateRole,
  remove,
  listUserIds,
};
