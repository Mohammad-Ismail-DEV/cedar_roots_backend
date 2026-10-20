// Remembers that a reminder for an event was already handled for a user, so it is sent once.
module.exports = (sequelize, DataTypes) => {
  const EventReminder = sequelize.define(
    "EventReminder",
    {
      event_id: { type: DataTypes.INTEGER, allowNull: false },
      user_id: { type: DataTypes.INTEGER, allowNull: false },
      sent_at: { type: DataTypes.DATE, allowNull: false },
    },
    {
      tableName: "EventReminders",
      timestamps: false,
      indexes: [{ unique: true, fields: ["event_id", "user_id"] }],
    }
  );

  return EventReminder;
};
