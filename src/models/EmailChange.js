// A pending "change my email" request, confirmed with a code sent to the new address.
module.exports = (sequelize, DataTypes) => {
  const EmailChange = sequelize.define(
    "EmailChange",
    {
      user_id: { type: DataTypes.INTEGER, primaryKey: true },
      new_email: { type: DataTypes.STRING(255), allowNull: false },
      code: { type: DataTypes.STRING(8), allowNull: false },
      expires_at: { type: DataTypes.DATE, allowNull: false },
    },
    { tableName: "EmailChanges", timestamps: false }
  );

  return EmailChange;
};
