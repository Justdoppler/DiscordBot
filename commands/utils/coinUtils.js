import { readFileSync, writeFileSync } from 'fs';
import { formatInTimeZone } from 'date-fns-tz';
import path from 'path';

const coinsFilePath = path.resolve('./json/dabcoins.json'); 

function getCurrentTimePDT() {
    const timeZone = 'America/Los_Angeles';
    const date = new Date();
    return formatInTimeZone(date, timeZone, 'MMM dd, yyyy hh:mm:ss a zzz');
}

function loadCoins(filePath = coinsFilePath, defaultValue = { lastUpdated: null }) {
    try {
        return JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (error) {
        return defaultValue;
    }
}

function saveCoins(data) {
    writeFileSync(coinsFilePath, JSON.stringify(data, null, 2), 'utf8');
}

function adjustCoins(userId, amount) {
    const coinsData = loadCoins(); // Load coins data with the correct path
    
    if (!coinsData[userId]) {
        coinsData[userId] = { balance: 0 };  // Initialize user balance if not already there
    }
    coinsData[userId].balance += amount;
    
    coinsData.lastUpdated = getCurrentTimePDT();
    
    saveCoins(coinsData);  // Save the updated data back to the file
    return coinsData[userId].balance;  // Return the updated balance
}

function getCoinBalance(userId) {
    const coinsData = loadCoins();  // Load coins data
    return coinsData[userId] ? coinsData[userId].balance : 0;  // Return balance or 0 if user not found
}

export { adjustCoins, getCoinBalance, loadCoins, saveCoins };