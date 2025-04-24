module.exports = (sequelize, DataTypes) => {
  const GroupMember = sequelize.define("GroupMember", {
    group_id: DataTypes.INTEGER,
    user_id: DataTypes.INTEGER,
    joined_at: DataTypes.DATE,
  });

  GroupMember.associate = (models) => {
    GroupMember.belongsTo(models.Group, { foreignKey: "group_id" });
    GroupMember.belongsTo(models.User, { foreignKey: "user_id" });
  };

  return GroupMember;
};
