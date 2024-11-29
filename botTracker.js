import fs from 'fs';
import path from 'path';

// File paths for lottery and leaderboard
const jackpotFilePath = path.join(path.resolve(), 'json/jackpot.json');
const ticketsFilePath = path.join(path.resolve(), 'json/tickets.json');
const leaderboardFilePath = path.join(path.resolve(), 'json/leaderboard.json');
const coinsFilePath = path.join(path.resolve(), 'json/dabcoins.json');
const lotteryPath = path.join(path.resolve(), 'json/lottery.json'); // Added missing path

// Helper functions
function loadJSON(filePath, defaultValue = {}) {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 4));
    }
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (error) {
        console.error(`Error reading JSON from ${filePath}:`, error);
        return defaultValue;
    }
}

function saveJSON(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
    } catch (error) {
        console.error(`Error writing JSON to ${filePath}:`, error);
    }
}

// Lottery draw logic
export function drawLotteryWinner() {
    const tickets = loadJSON(ticketsFilePath);
    const jackpot = loadJSON(jackpotFilePath, 0);

    const ticketEntries = Object.keys(tickets);
    if (ticketEntries.length === 0) {
        console.log('No tickets purchased this round. Jackpot rolls over.');
        return;
    }

    const winner = ticketEntries[Math.floor(Math.random() * ticketEntries.length)];
    console.log(`🎉 Lottery Winner: ${winner} won ${jackpot} dabcoins!`);

    // Update the winner's coin balance
    const coinsData = loadJSON(coinsFilePath);
    coinsData[winner] = coinsData[winner] || { balance: 0 };
    coinsData[winner].balance += jackpot;
    saveJSON(coinsFilePath, coinsData);

    // Reset lottery data
    saveJSON(jackpotFilePath, 0);
    saveJSON(ticketsFilePath, {});
}

// Leaderboard update logic
function updateLeaderboard() {
    const coinsData = loadJSON(coinsFilePath);
    const leaderboard = Object.entries(coinsData)
        .sort(([, a], [, b]) => b.balance - a.balance)
        .map(([username, { balance }]) => ({ username, balance }));

    saveJSON(leaderboardFilePath, leaderboard);
    console.log('🏆 Leaderboard updated!');
}

// Main tracking loop
function startAutoLottery() {
    const settings = loadJSON(lotteryPath, { autoStartTime: '00:00' });

    setInterval(() => {
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

        if (currentTime === settings.autoStartTime) {
            console.log('🎟️ Running automatic lottery draw...');
            drawLotteryWinner();
        }
    }, 60 * 1000); // Check every minute
}

export function startBotTracking() {
    console.log('🚀 Bot tracking started!');
    startAutoLottery();
}

// Export the tracking function
export default startBotTracking;
