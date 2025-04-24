module.exports = (sequelize, DataTypes) => {
    const Connection = sequelize.define("Connection", {
      sender_id: DataTypes.INTEGER,
      reciever_id: DataTypes.INTEGER,
      status: DataTypes.STRING,
      created_at: DataTypes.DATE
    });
  
    Connection.associate = models => {
      Connection.belongsTo(models.User, { foreignKey: "sender_id", as: "Sender" });
      Connection.belongsTo(models.User, { foreignKey: "reciever_id", as: "Receiver" });
    };
  
    return Connection;
  };
  