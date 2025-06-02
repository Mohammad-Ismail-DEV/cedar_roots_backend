module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define("Notification", {
    user_id: DataTypes.INTEGER,
    type: DataTypes.STRING,
    message: DataTypes.STRING,
    is_read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    data: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    created_at: DataTypes.DATE,
  });

  return Notification;
};
