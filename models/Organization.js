module.exports = (sequelize, DataTypes) => {
    const Organization = sequelize.define("Organization", {
      name: DataTypes.STRING,
      description: DataTypes.TEXT,
      location: DataTypes.STRING,
      website: DataTypes.STRING,
      created_at: DataTypes.DATE,
      updated_at: DataTypes.DATE,
      owner_id: DataTypes.INTEGER
    }, {
      tableName: 'Organizations',
      timestamps: false,
    });
  
    return Organization;
  };
  