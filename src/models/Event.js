module.exports = (sequelize, DataTypes) => {
  const Event = sequelize.define(
    "Event",
    {
      title: DataTypes.STRING,
      description: DataTypes.TEXT,
      location: DataTypes.STRING,
      date_time: DataTypes.DATE,
      organization_id: DataTypes.INTEGER,
      created_at: DataTypes.DATE, // Add this
      updated_at: DataTypes.DATE,
    },
    {
      tableName: "Events",
      timestamps: false,
    }
  );
  return Event;
};
