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
db.OrganizationMember = require("./OrganizationMember")(sequelize, DataTypes);
db.OrganizationFollower = require("./OrganizationFollower")(
  sequelize,
  DataTypes
);
db.Post = require("./Post")(sequelize, DataTypes);
db.Comment = require("./Comment")(sequelize, DataTypes);
db.Like = require("./Like")(sequelize, DataTypes);
db.Announcement = require("./Announcement")(sequelize, Sequelize);

// User ↔ UserVerification
db.User.hasOne(db.UserVerification, { foreignKey: "user_id" });
db.UserVerification.belongsTo(db.User, { foreignKey: "user_id" });

// Event ↔ User (Collaborators)
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
db.Message.belongsTo(db.User, { foreignKey: "sender_id", as: "sender" });
db.Message.belongsTo(db.User, { foreignKey: "receiver_id", as: "receiver" });

// Notifications
db.User.hasMany(db.Notification, { foreignKey: "user_id" });
db.Notification.belongsTo(db.User, { foreignKey: "user_id" });

// Search history
db.User.hasMany(db.SearchHistory, { foreignKey: "user_id" });
db.SearchHistory.belongsTo(db.User, { foreignKey: "user_id" });

// Firebase tokens
db.FirebaseToken.belongsTo(db.User, { foreignKey: "user_id" });

// Connections
db.User.hasMany(db.Connection, {
  foreignKey: "sender_id",
  as: "sentConnections",
});
db.User.hasMany(db.Connection, {
  foreignKey: "receiver_id",
  as: "receivedConnections",
});
db.Connection.belongsTo(db.User, { foreignKey: "sender_id", as: "Sender" });
db.Connection.belongsTo(db.User, { foreignKey: "receiver_id", as: "Receiver" });

// Organization → Events
db.Organization.hasMany(db.Event, { foreignKey: "organization_id" });
db.Event.belongsTo(db.Organization, { foreignKey: "organization_id" });

// Organization Members
db.Organization.hasMany(db.OrganizationMember, {
  foreignKey: "organization_id",
});
db.OrganizationMember.belongsTo(db.Organization, {
  foreignKey: "organization_id",
});
db.User.hasMany(db.OrganizationMember, { foreignKey: "user_id" });
db.OrganizationMember.belongsTo(db.User, { foreignKey: "user_id" });

// Organization Followers
db.Organization.hasMany(db.OrganizationFollower, {
  foreignKey: "organization_id",
});
db.OrganizationFollower.belongsTo(db.Organization, {
  foreignKey: "organization_id",
});
db.User.hasMany(db.OrganizationFollower, { foreignKey: "user_id" });
db.OrganizationFollower.belongsTo(db.User, { foreignKey: "user_id" });

// Posts
db.User.hasMany(db.Post, { foreignKey: "user_id" });
db.Post.belongsTo(db.User, { foreignKey: "user_id" });

// Comments
db.Post.hasMany(db.Comment, { foreignKey: "post_id", as: "Comments" });
db.Comment.belongsTo(db.Post, { foreignKey: "post_id" });
db.User.hasMany(db.Comment, { foreignKey: "user_id" });
db.Comment.belongsTo(db.User, { foreignKey: "user_id", as: "Author" }); // alias for clarity

// Likes
db.Post.hasMany(db.Like, { foreignKey: "post_id", as: "Likes" });
db.Like.belongsTo(db.Post, { foreignKey: "post_id" });
db.User.hasMany(db.Like, { foreignKey: "user_id" });
db.Like.belongsTo(db.User, { foreignKey: "user_id", as: "Liker" }); // alias for clarity

// Announcements
db.Event.hasMany(db.Announcement, { foreignKey: "event_id" });
db.Announcement.belongsTo(db.Event, { foreignKey: "event_id" });

//Event Participants
db.EventParticipant.belongsTo(db.User, { foreignKey: "user_id" });
db.EventParticipant.belongsTo(db.Event, { foreignKey: "event_id" });

module.exports = db;
