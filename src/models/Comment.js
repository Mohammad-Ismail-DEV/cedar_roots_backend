module.exports = (sequelize, DataTypes) => {
  const Comment = sequelize.define(
    "Comment",
    {
      user_id: DataTypes.INTEGER,
      post_id: DataTypes.INTEGER,
      content: DataTypes.TEXT,
      created_at: DataTypes.DATE,
    },
    {
      tableName: "Comments",
      timestamps: false,
    }
  );

  return Comment;
};
