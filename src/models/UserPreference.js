// Per-user notification settings. A missing row means "everything on".
module.exports = (sequelize, DataTypes) => {
  const UserPreference = sequelize.define(
    "UserPreference",
    {
      user_id: { type: DataTypes.INTEGER, primaryKey: true },
      push_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      event_reminders: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { tableName: "UserPreferences", timestamps: false }
  );

  return UserPreference;
};
