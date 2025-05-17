const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const dotenv = require("dotenv");
const admin = require("firebase-admin");
const serviceAccount = require("./firebase-settings.json");

dotenv.config();

const app = express();
const server = http.createServer(app);

// Firebase Admin Initialization
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] }));
app.use(express.json());

// Routes
app.use("/users", require("./routes/users"));
app.use("/auth", require("./routes/auth"));
app.use("/events", require("./routes/events"));
app.use("/messages", require("./routes/messages"));
app.use("/connections", require("./routes/connections"));
app.use("/notifications", require("./routes/notifications"));
app.use("/upload", require("./routes/upload"));
app.use("/organizations", require("./routes/organizations"));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/posts", require("./routes/posts"));
app.use("/comments", require("./routes/comments"));
app.use("/likes", require("./routes/likes"));
app.use("/organization_members", require("./routes/organization_members"));
app.use("/organization_followers", require("./routes/organization_followers"));
app.use("/search", require("./routes/search"));
app.use("/announcements", require("./routes/announcements"));

// Start server after DB sync (with WebSocket logic in socket.js)
const db = require("./models");
const initializeSocket = require("./services/socket");

db.sequelize.sync().then(() => {
  const io = initializeSocket(server);
  server.listen(process.env.PORT || 3000, () => {
    console.log("🚀 Server running on port", process.env.PORT || 3000);
  });
});
