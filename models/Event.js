module.exports = (sequelize, DataTypes) => {
    const Event = sequelize.define("Event", {
      title: DataTypes.STRING,
      description: DataTypes.TEXT,
      location: DataTypes.STRING,
      date_time: DataTypes.DATE,
      organizer_id: DataTypes.INTEGER
    });
  
    Event.associate = models => {
      Event.belongsTo(models.User, { foreignKey: "organizer_id" });
      Event.hasMany(models.EventParticipant, { foreignKey: "event_id" });
    };
  
    return Event;
  };
  