const { Sequelize, DataTypes } = require("sequelize");
const config = require("../services/config").development;

const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  {
    host: config.host,
    dialect: config.dialect,
  }
);

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

// Import models
db.User = require("./User")(sequelize, DataTypes);
db.UserVerification = require("./UserVerification")(sequelize, DataTypes);
db.Event = require("./Event")(sequelize, DataTypes);
db.EventParticipant = require("./EventParticipant")(sequelize, DataTypes);
db.Connection = require("./Connection")(sequelize, DataTypes);
db.Message = require("./Message")(sequelize, DataTypes);
db.Notification = require("./Notification")(sequelize, DataTypes);
db.SearchHistory = require("./SearchHistory")(sequelize, DataTypes);
db.FirebaseToken = require("./FirebaseToken")(sequelize, DataTypes);
db.Organization = require("./Organization")(sequelize, DataTypes);
db.Post = require("./Post")(sequelize, DataTypes);
db.Comment = require("./Comment")(sequelize, DataTypes);
db.Like = require("./Like")(sequelize, DataTypes);

// Define associations

// User verification
db.User.hasOne(db.UserVerification, { foreignKey: "user_id" });
db.UserVerification.belongsTo(db.User, { foreignKey: "user_id" });

// Events and organizer
db.User.hasMany(db.Event, { foreignKey: "organizer_id" });
db.Event.belongsTo(db.User, { foreignKey: "organizer_id" });

// Event Participants (many-to-many with role)
db.Event.belongsToMany(db.User, {
  through: db.EventParticipant,
  foreignKey: "event_id",
  as: "Collaborators",
});
db.User.belongsToMany(db.Event, {
  through: db.EventParticipant,
  foreignKey: "user_id",
  as: "Collaborations",
});

// Messages
db.User.hasMany(db.Message, { foreignKey: "sender_id", as: "sentMessages" });
db.User.hasMany(db.Message, {
  foreignKey: "receiver_id",
  as: "receivedMessages",
});
db.Message.belongsTo(db.User, { as: "sender", foreignKey: "sender_id" });
db.Message.belongsTo(db.User, { as: "receiver", foreignKey: "receiver_id" });

// Notifications
db.User.hasMany(db.Notification, { foreignKey: "user_id" });
db.Notification.belongsTo(db.User, { foreignKey: "user_id" });

// Search history
db.User.hasMany(db.SearchHistory, { foreignKey: "user_id" });
db.SearchHistory.belongsTo(db.User, { foreignKey: "user_id" });

// Firebase Tokens
db.FirebaseToken.belongsTo(db.User, { foreignKey: "user_id" });

// Connections
db.User.hasMany(db.Connection, {
  foreignKey: "sender_id",
  as: "sentConnections",
});
db.User.hasMany(db.Connection, {
  foreignKey: "reciever_id",
  as: "receivedConnections",
});
db.Connection.belongsTo(db.User, { foreignKey: "sender_id", as: "Sender" });
db.Connection.belongsTo(db.User, { foreignKey: "reciever_id", as: "Receiver" });

// Organizations
db.User.hasMany(db.Organization, { foreignKey: "owner_id" });
db.Organization.belongsTo(db.User, { foreignKey: "owner_id" });

// Organization → Events
db.Organization.hasMany(db.Event, { foreignKey: "organization_id" });
db.Event.belongsTo(db.Organization, { foreignKey: "organization_id" });

// Posts
db.User.hasMany(db.Post, { foreignKey: "user_id" });
db.Post.belongsTo(db.User, { foreignKey: "user_id" });

// Comments
db.User.hasMany(db.Comment, { foreignKey: "user_id" });
db.Comment.belongsTo(db.User, { foreignKey: "user_id" });
db.Post.hasMany(db.Comment, { foreignKey: "post_id" });
db.Comment.belongsTo(db.Post, { foreignKey: "post_id" });

// Likes
db.User.hasMany(db.Like, { foreignKey: "user_id" });
db.Like.belongsTo(db.User, { foreignKey: "user_id" });
db.Post.hasMany(db.Like, { foreignKey: "post_id" });
db.Like.belongsTo(db.Post, { foreignKey: "post_id" });

// Notifications
db.User.hasMany(db.Notification, { foreignKey: "user_id" });
db.Notification.belongsTo(db.User, { foreignKey: "user_id" });

module.exports = db;
