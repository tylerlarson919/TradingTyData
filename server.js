const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Middleware for CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Use the queryData routes
app.use('/api/queryData', require('./api/queryData'));

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});