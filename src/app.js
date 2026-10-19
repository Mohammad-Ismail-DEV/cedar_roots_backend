const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const env = require("./config/env");
const routes = require("./routes");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");

const app = express();

// Uploaded images are loaded cross-origin by the Flutter web build.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] }));
app.use(express.json({ limit: "1mb" }));

app.use("/uploads", express.static(env.uploadsDir));
app.use(routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
