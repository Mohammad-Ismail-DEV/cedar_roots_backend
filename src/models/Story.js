// A story: a photo or a text card that disappears 24 hours after it was posted.
module.exports = (sequelize, DataTypes) => {
  const Story = sequelize.define(
    "Story",
    {
      user_id: { type: DataTypes.INTEGER, allowNull: false },
      type: { type: DataTypes.STRING(10), allowNull: false }, // "image" | "text"
      image_url: DataTypes.STRING(500),
      text: DataTypes.STRING(300),
      // Which gradient a text story uses (the app maps the number to colours).
      bg: { type: DataTypes.INTEGER, defaultValue: 0 },
      created_at: { type: DataTypes.DATE, allowNull: false },
      expires_at: { type: DataTypes.DATE, allowNull: false },
    },
    {
      tableName: "Stories",
      timestamps: false,
      indexes: [{ fields: ["user_id"] }, { fields: ["expires_at"] }],
    }
  );

  return Story;
};
