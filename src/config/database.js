require('dotenv').config();

module.exports = {
  development: {
    connectionString: process.env.DATABASE_URL,
    ssl: false
  },
  production: {
    connectionString: process.env.DATABASE_URL,
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
};
