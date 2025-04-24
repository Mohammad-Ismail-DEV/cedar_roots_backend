module.exports = (sequelize, DataTypes) => {
    const EventParticipant = sequelize.define("EventParticipant", {
      event_id: DataTypes.INTEGER,
      user_id: DataTypes.INTEGER,
      status: DataTypes.STRING,
      joined_at: DataTypes.DATE
    });
  
    EventParticipant.associate = models => {
      EventParticipant.belongsTo(models.Event, { foreignKey: "event_id" });
      EventParticipant.belongsTo(models.User, { foreignKey: "user_id" });
    };
  
    return EventParticipant;
  };
  