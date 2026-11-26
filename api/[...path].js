const app = require('../server/index');

module.exports = async function handler(req, res) {
  await app.initialize();
  return app(req, res);
};
