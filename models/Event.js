module.exports = (sequelize, DataTypes) => {
  const Event = sequelize.define("Event", {
    title: DataTypes.STRING,
    description: DataTypes.TEXT,
    location: DataTypes.STRING,
    date_time: DataTypes.DATE,
    organizer_id: DataTypes.INTEGER,
    organization_id: DataTypes.INTEGER
  });

  return Event;
};
