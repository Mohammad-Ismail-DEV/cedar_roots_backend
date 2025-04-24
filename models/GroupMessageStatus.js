// models/GroupMessageStatus.js
module.exports = (sequelize, DataTypes) => {
    const GroupMessageStatus = sequelize.define("GroupMessageStatus", {
      group_message_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      read: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    });
  
    GroupMessageStatus.associate = (models) => {
      GroupMessageStatus.belongsTo(models.GroupMessage, {
        foreignKey: "group_message_id",
      });
      GroupMessageStatus.belongsTo(models.User, {
        foreignKey: "user_id",
      });
    };
  
    return GroupMessageStatus;
  };
  