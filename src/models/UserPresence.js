// When a user was last connected. "Online right now" is tracked in memory by the sockets.
module.exports = (sequelize, DataTypes) => {
  const UserPresence = sequelize.define(
    "UserPresence",
    {
      user_id: { type: DataTypes.INTEGER, primaryKey: true },
      last_seen_at: { type: DataTypes.DATE, allowNull: false },
    },
    { tableName: "UserPresences", timestamps: false }
  );

  return UserPresence;
};
