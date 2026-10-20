// Who watched which story (one row per viewer per story).
module.exports = (sequelize, DataTypes) => {
  const StoryView = sequelize.define(
    "StoryView",
    {
      story_id: { type: DataTypes.INTEGER, allowNull: false },
      viewer_id: { type: DataTypes.INTEGER, allowNull: false },
      viewed_at: { type: DataTypes.DATE, allowNull: false },
    },
    {
      tableName: "StoryViews",
      timestamps: false,
      indexes: [{ unique: true, fields: ["story_id", "viewer_id"] }, { fields: ["viewer_id"] }],
    }
  );

  return StoryView;
};
