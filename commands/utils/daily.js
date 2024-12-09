const fs = require('fs');
const path = require('path');

// Path to the JSON file for storing daily redemption data
const dataPath = path.resolve(__dirname, '../data/dailyRewards.json');

// Load or initialize the data
let dailyData = {};
if (fs.existsSync(dataPath)) {
    dailyData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
} else {
    fs.writeFileSync(dataPath, JSON.stringify(dailyData, null, 2));
}

/**
 * Saves the daily redemption data to the JSON file.
 */
function saveData() {
    fs.writeFileSync(dataPath, JSON.stringify(dailyData, null, 2));
}

/**
 * Checks if a user is eligible for the daily reward.
 * @param {string} userId - The Discord user ID.
 * @returns {boolean} True if the user is eligible, false otherwise.
 */
function canRedeemDaily(userId) {
    const lastRedeemed = dailyData[userId]?.lastRedeemed;
    if (!lastRedeemed) return true; // User has never redeemed

    const now = Date.now();
    return now - lastRedeemed >= 24 * 60 * 60 * 1000; // 24 hours
}

/**
 * Redeems the daily reward for a user.
 * @param {string} userId - The Discord user ID.
 */
function redeemDaily(userId) {
    dailyData[userId] = {
        lastRedeemed: Date.now(),
    };
    saveData();
}

module.exports = {
    canRedeemDaily,
    redeemDaily,
};