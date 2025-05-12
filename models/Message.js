module.exports = (sequelize, DataTypes) => {
  const Message = sequelize.define("Message", {
    sender_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    receiver_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    type: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    sent_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    read_status: {
      type: DataTypes.STRING,
      defaultValue: "sent",
    },
  });

  return Message;
};
