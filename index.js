// index.js
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits, Events } = require('discord.js');
const token = process.env.DISCORD_TOKEN;
const { initializeScryfallCache } = require('./utils/scryfall-cache.js');
const { loadAllCardsData } = require('./utils/scryfall-data.js');
const { initializeSearchCache } = require('./utils/search.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// --- Command Handling ---
client.commands = new Collection();
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}

// --- Event Handling ---
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
	const filePath = path.join(eventsPath, file);
	const event = require(filePath);
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	} else {
		client.on(event.name, (...args) => event.execute(...args));
	}
}

// --- Bot Startup Logic ---
client.once(Events.ClientReady, async (readyClient) => {
	console.log(`Bot logged in as ${readyClient.user.tag}. Initializing data caches...`);
    
    // --- NEW STARTUP ORDER ---
    // 1. Ensure the bulk data file is downloaded and up-to-date.
    await initializeScryfallCache();

    // 2. Load the ENTIRE dataset into memory.
    await loadAllCardsData();

    // 3. Initialize the search utility with names from the main cache.
    initializeSearchCache();

    console.log('✅ Caches are loaded. Bot is fully operational.');
});


client.login(token);