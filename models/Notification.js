module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define("Notification", {
    user_id: DataTypes.INTEGER,
    type: DataTypes.STRING,
    message: DataTypes.STRING,
    is_read: DataTypes.BOOLEAN,
    created_at: DataTypes.DATE,
  });

  return Notification;
};
