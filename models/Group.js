module.exports = (sequelize, DataTypes) => {
    const Group = sequelize.define("Group", {
      group_name: DataTypes.STRING,
      created_at: DataTypes.DATE
    });
  
    Group.associate = models => {
      Group.hasMany(models.GroupMember, { foreignKey: "group_id" });
    };
  
    return Group;
  };
  