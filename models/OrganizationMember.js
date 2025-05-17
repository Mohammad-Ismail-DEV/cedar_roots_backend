// models/OrganizationMember.js
module.exports = (sequelize, DataTypes) => {
  const OrganizationMember = sequelize.define("OrganizationMember", {
    organization_id: DataTypes.INTEGER,
    user_id: DataTypes.INTEGER,
    role: {
      type: DataTypes.STRING,
      defaultValue: "member",
    },
  });

  return OrganizationMember;
};
