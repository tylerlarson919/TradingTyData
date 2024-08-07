// api/queryData.js
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { format, parseISO, addMinutes } = require('date-fns');

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

function getCsvFilePaths(symbol, startDate, endDate) {
  const startYearMonth = format(startDate, 'yyyy-MM');
  const endYearMonth = format(endDate, 'yyyy-MM');

  const startFilePath = path.join(CSV_FOLDER, `${symbol}-${startYearMonth}.csv`);
  const endFilePath = path.join(CSV_FOLDER, `${symbol}-${endYearMonth}.csv`);

  console.log(`CSV file paths: ${startFilePath}, ${endFilePath}`);
  return [startFilePath, endFilePath];
}

function getIntervalData(data, interval, startDate, endDate) {
  const intervalMinutes = intervalToMinutes(interval);
  const filteredData = data.filter(row => {
    const timestamp = new Date(row.timestamp);
    return timestamp >= startDate && timestamp <= endDate;
  });

  console.log(`Filtered data length: ${filteredData.length}`);

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

  // Check if no data was found
  if (Object.keys(result).length === 0) {
    return null;
  }
  return result;
}

module.exports = async (req, res) => {
  try {
    const { symbol, interval, startDate, endDate } = req.query;

    console.log(`Received query params - symbol: ${symbol}, interval: ${interval}, startDate: ${startDate}, endDate: ${endDate}`);

    if (!symbol || !interval || !startDate || !endDate) {
      console.log('Missing required query parameters');
      return res.status(400).json({ error: 'Missing required query parameters' });
    }

    const start = parseISO(startDate);
    const end = parseISO(endDate);

    const csvFilePaths = getCsvFilePaths(symbol, start, end);

    let records = [];
    for (const csvFilePath of csvFilePaths) {
      if (fs.existsSync(csvFilePath)) {
        console.log(`Reading CSV file: ${csvFilePath}`);
        const fileContent = fs.readFileSync(csvFilePath, 'utf8');
        // Update the CSV parsing logic to correctly interpret the timestamps
        const parsedRecords = parse(fileContent, {
          columns: ['timestamp', 'open', 'high', 'low', 'close', 'volume'],
          skip_empty_lines: true,
        }).map(record => ({
          ...record,
          timestamp: new Date(record.timestamp.replace(/(\d{4})(\d{2})(\d{2}) (\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6Z'))
        }));
        records = records.concat(parsedRecords);
      } else {
        console.log(`CSV file not found: ${csvFilePath}`);
      }
    }

    console.log(`Total records length: ${records.length}`);

    if (records.length === 0) {
      console.log('CSV files not found for the given date range');
      return res.status(404).json({ error: 'CSV files not found for the given date range' });
    }

    const intervalData = getIntervalData(records, interval, start, end);

    if (!intervalData) {
      console.log('Invalid date range');
      return res.status(400).json({ error: 'Invalid date range' });
    }

    console.log('Returning interval data');
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
    console.error('Error in queryData API:', error); // Log the error
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
