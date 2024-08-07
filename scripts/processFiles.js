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
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const lines = fileContent.split('\n').filter(line => line.trim());
  
  const records = lines.map(line => {
    const [timestamp, open, high, low, close, volume] = line.split(';');
    return { timestamp, open, high, low, close, volume };
  });

  records.forEach(record => {
    const month = getMonthFromDate(record.timestamp);
    const csvFilePath = path.join(CSV_FOLDER, `${path.basename(filePath)}-${month}.csv`);
    
    if (fs.existsSync(csvFilePath)) {
      const existingData = fs.readFileSync(csvFilePath, 'utf8');
      const existingRecords = parse(existingData, { columns: true });
      const updatedRecords = [...existingRecords, record];
      const csvData = stringify(updatedRecords, { header: true });
      fs.writeFileSync(csvFilePath, csvData);
    } else {
      const csvData = stringify([record], { header: true });
      fs.writeFileSync(csvFilePath, csvData);
    }
  });
}

// Process all files in the text folder
fs.readdirSync(TXT_FOLDER).forEach(file => {
  const filePath = path.join(TXT_FOLDER, file);
  processTextFile(filePath);
});
