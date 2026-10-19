const organizationMember = require("../services/organizationMember");

// pick(req) returns the organization id from the already-validated request.
function requireOrgRole(roles, pick) {
  return async (req, res, next) => {
    await organizationMember.assertRole(req.user.id, pick(req), roles);
    next();
  };
}

module.exports = requireOrgRole;
