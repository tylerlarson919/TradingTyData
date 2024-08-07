// api/uploadToGitHub.js
const axios = require('axios');

const GITHUB_API_URL = 'https://api.github.com/repos/tylerlarson919/TradingTyData/contents';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Use environment variable

module.exports = async (req, res) => {
  res.status(200).json({ message: 'Manual upload required' });
};
