const AppError = require("../utils/AppError");

// Parses body/params/query with zod. Results land in req.valid; req.body is
// replaced with the parsed copy so unknown fields never reach services.
function validate({ body, params, query } = {}) {
  return (req, res, next) => {
    const valid = {};
    for (const [key, schema] of Object.entries({ body, params, query })) {
      if (!schema) continue;
      const result = schema.safeParse(req[key]);
      if (!result.success) {
        const issue = result.error.issues[0];
        const field = issue.path.join(".");
        throw AppError.badRequest(field ? `${field}: ${issue.message}` : issue.message);
      }
      valid[key] = result.data;
    }
    if (valid.body) req.body = valid.body;
    req.valid = valid;
    next();
  };
}

module.exports = validate;
