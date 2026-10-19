const organizationService = require("../services/organization");
const memberService = require("../services/organizationMember");
const followerService = require("../services/follower");

exports.create = async (req, res) =>
  res.status(201).json(await organizationService.create(req.user.id, req.body));
exports.list = async (req, res) => res.json(await organizationService.list(req.valid.query));
exports.listForUser = async (req, res) =>
  res.json(await organizationService.listForUser(req.valid.params.id));
exports.getById = async (req, res) =>
  res.json(await organizationService.getById(req.valid.params.id));
exports.update = async (req, res) =>
  res.json(await organizationService.update(req.valid.params.id, req.body));
exports.remove = async (req, res) => {
  await organizationService.remove(req.valid.params.id);
  res.json({ message: "Organization deleted" });
};

exports.addMember = async (req, res) => res.json(await memberService.add(req.user.id, req.body));
exports.listMembers = async (req, res) =>
  res.json(await memberService.listForOrganization(req.valid.params.organizationId));
exports.getMember = async (req, res) => {
  const { organizationId, userId } = req.valid.params;
  res.json(await memberService.get(organizationId, userId));
};
exports.updateMemberRole = async (req, res) =>
  res.json({
    message: "Role updated",
    member: await memberService.updateRole(req.user.id, req.body),
  });
exports.removeMember = async (req, res) => {
  await memberService.remove(req.user.id, req.body);
  res.json({ message: "Member removed" });
};

exports.follow = async (req, res) =>
  res.status(201).json(await followerService.follow(req.user.id, req.body.organization_id));
exports.unfollow = async (req, res) => {
  await followerService.unfollow(req.user.id, req.body.organization_id);
  res.json({ message: "Unfollowed organization" });
};
exports.listFollowers = async (req, res) =>
  res.json(await followerService.listForOrganization(req.valid.params.organization_id));
