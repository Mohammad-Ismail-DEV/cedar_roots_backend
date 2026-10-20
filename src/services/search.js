const { Op } = require("sequelize");
const { Post, Event, User, Organization, SearchHistory } = require("../models");

const LIMIT = 20;

async function search(userId, term) {
  const like = { [Op.like]: `%${term}%` };

  const [, posts, events, users, organizations] = await Promise.all([
    SearchHistory.create({ user_id: userId, search_term: term, searched_at: new Date() }),
    Post.findAll({
      where: { content: like },
      include: [{ model: User, attributes: ["id", "name", "profile_pic"] }],
      limit: LIMIT,
    }),
    Event.findAll({ where: { [Op.or]: [{ title: like }, { location: like }] }, limit: LIMIT }),
    User.findAll({
      where: { name: like },
      attributes: ["id", "name", "profile_pic"],
      limit: LIMIT,
    }),
    Organization.findAll({ where: { name: like }, limit: LIMIT }),
  ]);

  return { posts, events, users, organizations };
}

module.exports = { search };
