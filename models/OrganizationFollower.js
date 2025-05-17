module.exports = (sequelize, DataTypes) => {
  const OrganizationFollower = sequelize.define('OrganizationFollower', {
    organization_id: DataTypes.INTEGER,
    user_id: DataTypes.INTEGER,
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  });

  return OrganizationFollower;
};
