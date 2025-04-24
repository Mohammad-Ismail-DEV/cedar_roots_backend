const { Sequelize, DataTypes } = require('sequelize');
const config = require('../config').development;

const sequelize = new Sequelize(config.database, config.username, config.password, {
  host: config.host,
  dialect: config.dialect,
});

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

// Import models

db.GroupMessageStatus = require('./GroupMessageStatus')(sequelize, DataTypes);
db.User = require('./User')(sequelize, DataTypes);
db.UserVerification = require('./UserVerification')(sequelize, DataTypes);
db.Event = require('./Event')(sequelize, DataTypes);
db.EventParticipant = require('./EventParticipant')(sequelize, DataTypes);
db.Connection = require('./Connection')(sequelize, DataTypes);
db.Message = require('./Message')(sequelize, DataTypes);
db.Group = require('./Group')(sequelize, DataTypes);
db.GroupMember = require('./GroupMember')(sequelize, DataTypes);
db.Notification = require('./Notification')(sequelize, DataTypes);
db.SearchHistory = require('./SearchHistory')(sequelize, DataTypes);
db.GroupMessage = require('./GroupMessage')(sequelize, DataTypes);
db.FirebaseToken = require('./FirebaseToken')(sequelize, DataTypes);

// Define relationships (example)
db.User.hasOne(db.UserVerification, { foreignKey: 'user_id' });
db.UserVerification.belongsTo(db.User, { foreignKey: 'user_id' });

db.User.hasMany(db.Event, { foreignKey: 'organizer_id' });
db.Event.belongsTo(db.User, { foreignKey: 'organizer_id' });

db.User.belongsToMany(db.Event, { through: db.EventParticipant, foreignKey: 'user_id' });
db.Event.belongsToMany(db.User, { through: db.EventParticipant, foreignKey: 'event_id' });

// db.User.hasMany(db.Message, { foreignKey: 'sender_id' });

db.User.hasMany(db.Message, { foreignKey: 'sender_id', as: 'sentMessages' });
db.User.hasMany(db.Message, { foreignKey: 'receiver_id', as: 'receivedMessages' });
db.Message.belongsTo(db.User, { as: 'sender', foreignKey: 'sender_id' });
db.Message.belongsTo(db.User, { as: 'receiver', foreignKey: 'receiver_id' });


db.User.belongsToMany(db.Group, { through: db.GroupMember, foreignKey: 'user_id' });
db.Group.belongsToMany(db.User, { through: db.GroupMember, foreignKey: 'group_id' });

db.User.hasMany(db.Notification, { foreignKey: 'user_id' });

db.User.hasMany(db.SearchHistory, { foreignKey: 'user_id' });

db.Group.hasMany(db.GroupMessage, { foreignKey: 'group_id' });
db.User.hasMany(db.GroupMessage, { foreignKey: 'sender_id' });
db.GroupMessage.belongsTo(db.Group, { foreignKey: 'group_id' });
db.GroupMessage.belongsTo(db.User, { foreignKey: 'sender_id', as: 'groupSender' });
db.GroupMessage.hasMany(db.GroupMessageStatus, {
  foreignKey: 'group_message_id',
  as: 'statuses',
});
db.FirebaseToken.belongsTo(db.User, { foreignKey: 'user_id' });


db.GroupMessageStatus.belongsTo(db.GroupMessage, {
  foreignKey: "group_message_id",
});
db.GroupMessageStatus.belongsTo(db.User, {
  foreignKey: "user_id",
});

module.exports = db;
