module.exports = (sequelize, DataTypes) => {
  const Like = sequelize.define(
    "Like",
    {
      user_id: DataTypes.INTEGER,
      post_id: DataTypes.INTEGER,
      created_at: DataTypes.DATE,
    },
    {
      tableName: "Likes",
      timestamps: false,
    }
  );

  return Like;
};
