const functions = require('firebase-functions');
const cors = require('cors')({ origin: true });
const admin = require('firebase-admin');
const { parse } = require('csv-parse/sync');
const { format, parseISO, addMinutes } = require('date-fns');

// Initialize Firebase Admin
const serviceAccount = {
  type: 'service_account',
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.GOOGLE_CLIENT_ID,
  auth_uri: process.env.GOOGLE_AUTH_URI,
  token_uri: process.env.GOOGLE_TOKEN_URI,
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL.replace(/@.*/, '')}`
};

const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: storageBucket,
  });
}

const bucket = admin.storage().bucket();

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

  const startFilePath = `${symbol}-${startYearMonth}.csv`;
  const endFilePath = `${symbol}-${endYearMonth}.csv`;

  return [startFilePath, endFilePath];
}

async function getFileContent(filePath) {
  const file = bucket.file(filePath);
  const [exists] = await file.exists();
  if (!exists) {
    return null;
  }

  const [contents] = await file.download();
  return contents.toString('utf8');
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

  if (Object.keys(result).length === 0) {
    return null;
  }
  return result;
}

exports.yourFunctionName = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { symbol, interval, startDate, endDate } = req.query;

      if (!symbol || !interval || !startDate || !endDate) {
        return res.status(400).json({ error: 'Missing required query parameters' });
      }

      const start = parseISO(startDate);
      const end = parseISO(endDate);

      const csvFilePaths = getCsvFilePaths(symbol, start, end);

      let records = [];
      for (const csvFilePath of csvFilePaths) {
        const fileContent = await getFileContent(csvFilePath);
        if (fileContent) {
          const parsedRecords = parse(fileContent, {
            columns: ['timestamp', 'open', 'high', 'low', 'close', 'volume'],
            skip_empty_lines: true,
          }).map(record => ({
            ...record,
            timestamp: new Date(record.timestamp.replace(/(\d{4})(\d{2})(\d{2}) (\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6Z'))
          }));
          records = records.concat(parsedRecords);
        }
      }

      if (records.length === 0) {
        return res.status(404).json({ error: 'CSV files not found for the given date range' });
      }

      const intervalData = getIntervalData(records, interval, start, end);

      if (!intervalData) {
        return res.status(400).json({ error: 'Invalid date range' });
      }

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
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
});
