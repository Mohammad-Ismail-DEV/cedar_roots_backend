const authService = require("../services/auth");

exports.signup = async (req, res) => res.json(await authService.signup(req.body));
exports.verify = async (req, res) => res.json(await authService.verify(req.body));
exports.resend = async (req, res) => res.json(await authService.resendCode(req.body));
exports.login = async (req, res) => res.json(await authService.login(req.body));
