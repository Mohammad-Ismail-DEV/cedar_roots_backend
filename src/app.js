const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const env = require("./config/env");
const routes = require("./routes");
const { imageVariants } = require("./middleware/imageVariants");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");

const app = express();

// Behind ngrok or a load balancer: honour X-Forwarded-Proto/For so req.protocol is
// "https" (uploaded file URLs) and rate limiting sees the real client address.
app.set("trust proxy", 1);

// Uploaded images are loaded cross-origin by the Flutter web build.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] }));
app.use(express.json({ limit: "1mb" }));

// File names are unique per upload, so browsers/apps may cache them forever.
app.use(
  "/uploads",
  imageVariants,
  express.static(env.uploadsDir, { maxAge: "365d", immutable: true })
);
// Android App Links: tells Android this server's /p/ links belong to the app.
app.get("/.well-known/assetlinks.json", (req, res) =>
  res.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "com.mohamadismail.cedarroots",
        sha256_cert_fingerprints: env.androidCertFingerprints,
      },
    },
  ])
);
app.use("/p", require("./routes/share"));
app.use(routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
