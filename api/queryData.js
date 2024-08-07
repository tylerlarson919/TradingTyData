// api/queryData.js
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { format, parseISO, addMinutes, subMinutes, startOfMonth, endOfMonth } = require('date-fns');

const CSV_FOLDER = './csvFiles';

// Interval conversion functions
const intervalToMinutes = (interval) => {
  switch (interval) {
    case '1m': return 1;
    case '5m': return 5;
    case '10m': return 10;
    case '15m': return 15;
    case '30m': return 30;
    case '45m': return 45;
    case '1H': return 60;
    case '4H': return 240;
    case '1D': return 1440;
    case '1W': return 10080;
    case '1Month': return 43200;
    default: throw new Error('Unsupported interval');
  }
};

function getCsvFilePath(symbol) {
  return path.join(CSV_FOLDER, `${symbol}.csv`);
}

function getIntervalData(data, interval, startDate, endDate) {
  const intervalMinutes = intervalToMinutes(interval);
  const filteredData = data.filter(row => {
    const timestamp = new Date(row.timestamp);
    return timestamp >= startDate && timestamp <= endDate;
  });

  const result = {};
  let lastDate = startDate;
  while (lastDate <= endDate) {
    const intervalData = filteredData.filter(row => {
      const timestamp = new Date(row.timestamp);
      return timestamp >= lastDate && timestamp < addMinutes(lastDate, intervalMinutes);
    });

    if (intervalData.length) {
      const [first] = intervalData;
      const last = intervalData[intervalData.length - 1];
      result[format(lastDate, 'yyyy-MM-dd HH:mm:ss')] = {
        '1. open': first.open,
        '2. high': Math.max(...intervalData.map(row => parseFloat(row.high))),
        '3. low': Math.min(...intervalData.map(row => parseFloat(row.low))),
        '4. close': last.close,
        '5. volume': intervalData.reduce((sum, row) => sum + parseInt(row.volume), 0),
      };
    }
    lastDate = addMinutes(lastDate, intervalMinutes);
  }
  return result;
}

module.exports = async (req, res) => {
  try {
    const { function: symbol, interval, startDate, endDate } = req.query;

    if (!symbol || !interval || !startDate || !endDate) {
      return res.status(400).json({ error: 'Missing required query parameters' });
    }

    const csvFilePath = getCsvFilePath(symbol);
    if (!fs.existsSync(csvFilePath)) {
      return res.status(404).json({ error: 'CSV file not found' });
    }

    const fileContent = fs.readFileSync(csvFilePath, 'utf8');
    const records = parse(fileContent, { columns: true });

    const start = parseISO(startDate);
    const end = parseISO(endDate);

    const intervalData = getIntervalData(records, interval, start, end);

    res.json({
      'Meta Data': {
        '1. Information': `Intraday (${interval}) open, high, low, close prices and volume`,
        '2. Symbol': symbol,
        '3. Last Refreshed': endDate,
        '4. Interval': interval,
        '5. Output Size': 'Full size',
        '6. Time Zone': 'US/Eastern',
      },
      [`Time Series (${interval})`]: intervalData,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
