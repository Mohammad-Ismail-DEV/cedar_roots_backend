const { Op } = require("sequelize");
const {
  sequelize,
  Organization,
  Event,
  User,
  OrganizationMember,
  OrganizationFollower,
} = require("../models");
const AppError = require("../utils/AppError");

async function create(userId, fields) {
  return sequelize.transaction(async (transaction) => {
    const organization = await Organization.create(
      { ...fields, created_at: new Date(), updated_at: new Date() },
      { transaction }
    );
    await OrganizationMember.create(
      { user_id: userId, organization_id: organization.id, role: "owner" },
      { transaction }
    );
    return organization;
  });
}

async function list({ search }) {
  return Organization.findAll({
    where: search ? { name: { [Op.like]: `%${search}%` } } : undefined,
  });
}

async function listForUser(userId) {
  const memberships = await OrganizationMember.findAll({
    where: { user_id: userId },
    include: [Organization],
  });
  return memberships.map((m) => m.Organization);
}

async function getById(id) {
  // Sequelize mutates include objects, so each include needs its own copy.
  const userInclude = () => ({ model: User, attributes: ["id", "name", "profile_pic"] });
  const organization = await Organization.findByPk(id, {
    include: [
      { model: Event },
      { model: OrganizationFollower, include: [userInclude()] },
      { model: OrganizationMember, include: [userInclude()] },
    ],
  });
  if (!organization) throw AppError.notFound("Organization not found");
  return organization;
}

async function update(id, fields) {
  const organization = await Organization.findByPk(id);
  if (!organization) throw AppError.notFound("Organization not found");
  await organization.update({ ...fields, updated_at: new Date() });
  return organization;
}

async function remove(id) {
  await Organization.destroy({ where: { id } });
}

module.exports = { create, list, listForUser, getById, update, remove };
