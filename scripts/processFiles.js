const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');

// Folder paths
const TXT_FOLDER = './txtFiles';
const CSV_FOLDER = './csvFiles';

function getMonthFromDate(dateString) {
  const month = dateString.slice(4, 6);
  const year = dateString.slice(0, 4);
  return `${year}-${month}`;
}

function processTextFile(filePath) {
  console.log(`Processing file: ${filePath}`);

  const fileContent = fs.readFileSync(filePath, 'utf8');
  const lines = fileContent.split('\n').filter(line => line.trim());

  if (lines.length === 0) {
    console.warn(`No data found in file: ${filePath}`);
    return;
  }

  // Parse records from lines
  const records = lines.map(line => {
    const [timestamp, open, high, low, close, volume] = line.split(';');
    return { timestamp, open, high, low, close, volume };
  });

  // Extract the base name of the file without extension
  const baseName = path.basename(filePath, path.extname(filePath));

  // Use a Map to keep track of records by month
  const recordsByMonth = new Map();

  records.forEach(record => {
    const month = getMonthFromDate(record.timestamp);
    if (!recordsByMonth.has(month)) {
      recordsByMonth.set(month, []);
    }
    recordsByMonth.get(month).push(record);
  });

  // Write records to CSV files
  recordsByMonth.forEach((records, month) => {
    const csvFilePath = path.join(CSV_FOLDER, `${baseName}-${month}.csv`);
    const csvData = stringify(records, { header: true });
    fs.writeFileSync(csvFilePath, csvData);
    console.log(`Written file: ${csvFilePath}`);
  });
}

async function processAllFiles() {
  try {
    const files = fs.readdirSync(TXT_FOLDER);
    console.log(`Found ${files.length} file(s) to process.`);
    
    if (files.length === 0) {
      console.warn('No files found in the text folder.');
      return;
    }

    for (const file of files) {
      const filePath = path.join(TXT_FOLDER, file);
      console.log(`Starting processing for file: ${filePath}`);
      try {
        await processTextFile(filePath);
      } catch (err) {
        console.error(`Error processing file ${filePath}:`, err);
      }
    }
  } catch (err) {
    console.error('Error reading files from directory:', err);
  } finally {
    console.log('Processing complete. Exiting...');
    process.exit(0); // Explicitly terminate the process
  }
}

// Start processing all files
processAllFiles();
