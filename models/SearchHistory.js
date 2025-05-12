module.exports = (sequelize, DataTypes) => {
  const SearchHistory = sequelize.define("SearchHistory", {
    user_id: DataTypes.INTEGER,
    search_term: DataTypes.STRING,
    searched_at: DataTypes.DATE,
  });

  return SearchHistory;
};
