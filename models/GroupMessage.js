module.exports = (sequelize, DataTypes) => {
  const GroupMessage = sequelize.define('GroupMessage', {
    group_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    sender_id: { // ✅ renamed from user_id to sender_id
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    sent_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  });

  GroupMessage.associate = (models) => {
    GroupMessage.belongsTo(models.Group, { foreignKey: 'group_id' });
    GroupMessage.belongsTo(models.User, {
      foreignKey: 'sender_id', // ✅ must match the field
      as: 'groupSender',
    });
    GroupMessage.hasMany(models.GroupMessageStatus, {
      foreignKey: 'group_message_id',
      as: 'statuses',
    });    
  };

  return GroupMessage;
};
