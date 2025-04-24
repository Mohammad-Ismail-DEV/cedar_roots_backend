module.exports = (sequelize, DataTypes) => {
    const UserVerification = sequelize.define("UserVerification", {
      user_id: DataTypes.INTEGER,
      verification_code: DataTypes.STRING,
      expires_at: DataTypes.DATE,
      status: DataTypes.STRING
    });
  
    UserVerification.associate = models => {
      UserVerification.belongsTo(models.User, { foreignKey: "user_id" });
    };
  
    return UserVerification;
  };
  