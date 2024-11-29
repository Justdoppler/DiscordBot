// config.js
import { config } from 'dotenv';
import path from 'path';

// Load the .env file
config({ path: path.resolve('./settings.env') });

// Export environment variables
export const ENV = {
    TOKEN: process.env.DISCORD_BOT_TOKEN,
    CHANNEL_ID: process.env.DISCORD_CHANNEL_ID,
    ALLOWED_SERVER_IDS: process.env.ALLOWED_SERVER_IDS?.split(',') || [],
    DEFAULT_TIMEZONE: process.env.DEFAULT_TIMEZONE || 'America/Los_Angeles'
};
