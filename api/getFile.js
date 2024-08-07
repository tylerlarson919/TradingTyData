// api/getFile.js
const axios = require('axios');

module.exports = async (req, res) => {
  try {
    const { filePath } = req.query;
    const response = await axios.get(`https://raw.githubusercontent.com/tylerlarson919/TradingTyData/main/${filePath}`);
    res.status(200).send(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
