module.exports = (sequelize, DataTypes) => {
  const Connection = sequelize.define(
    "Connection",
    {
      sender_id: DataTypes.INTEGER,
      receiver_id: DataTypes.INTEGER,
      status: DataTypes.STRING,
      created_at: DataTypes.DATE,
      updated_at: DataTypes.DATE,
    },
    {
      tableName: "Connections",
      timestamps: false,
    },
  );

  return Connection;
};
