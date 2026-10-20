const { z, text } = require("./common");

const email = z.string().trim().toLowerCase().email().max(255);

module.exports = {
  signup: z.object({
    email,
    password: z.string().min(6).max(72),
    name: text(100),
  }),
  verify: z.object({ email, code: z.string().regex(/^\d{4}$/, "must be 4 digits") }),
  resend: z.object({ email }),
  login: z.object({ email, password: z.string().min(1).max(72) }),
  changePassword: z.object({
    current_password: z.string().min(1).max(72),
    new_password: z.string().min(6).max(72),
  }),
  startEmailChange: z.object({ new_email: email, password: z.string().min(1).max(72) }),
  confirmEmailChange: z.object({ code: z.string().regex(/^\d{4}$/, "must be 4 digits") }),
};
