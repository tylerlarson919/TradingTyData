# TradingTyData
data for trading ty
1. download ninja trader market replay data and rename to txt file to something like "ES.txt"
2. put txt file into "txtFiles" folder
3. run convert-files.bat
4. upload files in "csvFiles" folder to Firestore server under "Storage"
5. update available search symbols in "TradingViewChartModule.tsx" if its a new ticker
5. done :) data is uploaded and can be used by app
