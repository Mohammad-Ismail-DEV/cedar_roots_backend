// A post a user bookmarked.
module.exports = (sequelize, DataTypes) => {
  const SavedPost = sequelize.define(
    "SavedPost",
    {
      user_id: { type: DataTypes.INTEGER, allowNull: false },
      post_id: { type: DataTypes.INTEGER, allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false },
    },
    {
      tableName: "SavedPosts",
      timestamps: false,
      indexes: [{ unique: true, fields: ["user_id", "post_id"] }, { fields: ["post_id"] }],
    }
  );

  return SavedPost;
};
