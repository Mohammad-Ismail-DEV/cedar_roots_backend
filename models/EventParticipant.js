module.exports = (sequelize, DataTypes) => {
  const EventParticipant = sequelize.define("EventParticipant", {
    event_id: DataTypes.INTEGER,
    user_id: DataTypes.INTEGER,
    status: DataTypes.STRING,
    role: {
      type: DataTypes.STRING,
      defaultValue: "attendee", // default role can be changed as needed
    },
    joined_at: DataTypes.DATE,
  });

  return EventParticipant;
};
