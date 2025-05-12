const dotenv = require('dotenv');
dotenv.config()

module.exports = {
    development: {
      username: process.env.DB_USERNAME,
      password: process.env.PASSWORD,
      database: 'cedar_roots_db',
      host: '127.0.0.1',
      dialect: 'mysql',
    },
  };
  