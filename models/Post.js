module.exports = (sequelize, DataTypes) => {
  const Post = sequelize.define(
    "Post",
    {
      user_id: DataTypes.INTEGER,
      content: DataTypes.TEXT,
      image_url: DataTypes.STRING,
      created_at: DataTypes.DATE,
      updated_at: DataTypes.DATE,
    },
    {
      tableName: "Posts",
      timestamps: false,
    }
  );

  return Post;
};
