module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define('User', {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      name: DataTypes.STRING,
      email: { type: DataTypes.STRING, unique: true },
      password_hash: DataTypes.STRING,
      profile_pic: DataTypes.STRING,
      bio: DataTypes.TEXT,
      location: DataTypes.STRING,
      created_at: DataTypes.DATE,
      updated_at: DataTypes.DATE,
    }, {
      tableName: 'Users',
      timestamps: false,
    });
  
    return User;
  };
  