/**
 * Auto Push GitHub Bot controlled via Telegram
 * Created by https://github.com/xsrazy
 * Features:
 * - Input GitHub Token, Username, Repo(s)
 * - Specify file to push (default: log.md)
 * - Delay between pushes (seconds)
 * - Stop the bot
 * - Runs continuously until stopped
 * - Public use (no user authentication)
 */

const TelegramBot = require('node-telegram-bot-api');
const { Octokit } = require('@octokit/rest');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file if exists
require('dotenv').config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TELEGRAM_BOT_TOKEN) {
  console.error('Error: TELEGRAM_BOT_TOKEN is not set in environment variables.');
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// State to hold user settings and bot status per chat
const userStates = new Map();

function getUserState(chatId) {
  if (!userStates.has(chatId)) {
    userStates.set(chatId, {
      githubToken: null,
      username: null,
      repos: [],
      file: 'log.md',
      delay: 60,
      pushing: false,
      pushIntervalId: null,
      octokit: null,
    });
  }
  return userStates.get(chatId);
}

function startPushing(chatId) {
  const state = getUserState(chatId);
  if (!state.githubToken || !state.username || state.repos.length === 0) {
    bot.sendMessage(chatId, 'Please set GitHub Token, Username, and at least one Repo before starting.');
    return;
  }
  if (state.pushing) {
    bot.sendMessage(chatId, 'Bot is already running.');
    return;
  }
  state.octokit = new Octokit({ auth: state.githubToken });
  state.pushing = true;
  bot.sendMessage(chatId, `Starting auto push every ${state.delay} seconds for repos: ${state.repos.join(', ')}`);

  state.pushIntervalId = setInterval(async () => {
    for (const repo of state.repos) {
      try {
        await pushFileToRepo(chatId, repo);
        bot.sendMessage(chatId, `Pushed file "${state.file}" to repo "${repo}" successfully.`);
      } catch (error) {
        bot.sendMessage(chatId, `Error pushing to repo "${repo}": ${error.message}`);
      }
    }
  }, state.delay * 1000);
}

function stopPushing(chatId) {
  const state = getUserState(chatId);
  if (!state.pushing) {
    bot.sendMessage(chatId, 'Bot is not running.');
    return;
  }
  clearInterval(state.pushIntervalId);
  state.pushIntervalId = null;
  state.pushing = false;
  bot.sendMessage(chatId, 'Bot stopped.');
}

async function pushFileToRepo(chatId, repo) {
  const state = getUserState(chatId);
  // Write message with WIB (GMT+7) time to file before pushing
  const filePath = path.resolve(state.file);
  // Get current time in WIB/GMT+7
  const date = new Date();
  const wibDate = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
  
  const wibTime = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date);
  
  const autoMessage = `Auto update WIB (GMT+7)\nDate: ${wibDate}\nTime: ${wibTime}\n`;
  fs.writeFileSync(filePath, autoMessage, 'utf8');

  // Read updated file content
  const content = fs.readFileSync(filePath, 'utf8');
  const contentBase64 = Buffer.from(content).toString('base64');

  // Get the SHA of the existing file if exists
  let sha = null;
  try {
    const { data } = await state.octokit.repos.getContent({
      owner: state.username,
      repo,
      path: state.file,
    });
    sha = data.sha;
  } catch (error) {
    // File does not exist, will create new
    if (error.status !== 404) {
      throw error;
    }
  }

  // Commit message with timestamp
  const message = `Auto update ${state.file} at ${new Date().toISOString()}`;

  // Create or update file
  await state.octokit.repos.createOrUpdateFileContents({
    owner: state.username,
    repo,
    path: state.file,
    message,
    content: contentBase64,
    sha: sha || undefined,
  });
}

// Keyboard layouts
const mainKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [{ text: '⚙️ Settings', callback_data: 'settings' }],
      [{ text: '▶️ Start Push', callback_data: 'startpush' }, { text: '⏹️ Stop Push', callback_data: 'stoppush' }],
      [{ text: '📊 Status', callback_data: 'status' }]
    ]
  }
};

const settingsKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [{ text: '🔑 Set GitHub Token', callback_data: 'settoken' }],
      [{ text: '👤 Set Username', callback_data: 'setusername' }],
      [{ text: '📁 Set Repos', callback_data: 'setrepos' }],
      [{ text: '📄 Set File', callback_data: 'setfile' }],
      [{ text: '⏱️ Set Delay', callback_data: 'setdelay' }],
      [{ text: '🔙 Back to Main Menu', callback_data: 'mainmenu' }]
    ]
  }
};

// State for tracking user input mode
const userInputStates = new Map();

function setUserInputState(chatId, state) {
  userInputStates.set(chatId, state);
}

function getUserInputState(chatId) {
  return userInputStates.get(chatId);
}

bot.onText(/\/start/, (msg) => {
  const welcomeMessage = `Welcome to Auto Push GitHub Bot!\nCreated by https://github.com/xsrazy\n\nPlease use the buttons below to control the bot:`;
  bot.sendMessage(msg.chat.id, welcomeMessage, mainKeyboard);
});

// Handle button callbacks
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const action = callbackQuery.data;

  switch (action) {
    case 'mainmenu':
      await bot.editMessageText('Main Menu:', {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        ...mainKeyboard
      });
      break;

    case 'settings':
      await bot.editMessageText('Settings Menu:', {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        ...settingsKeyboard
      });
      break;

    case 'settoken':
      setUserInputState(chatId, 'waiting_token');
      await bot.sendMessage(chatId, 'Please enter your GitHub personal access token:');
      break;

    case 'setusername':
      setUserInputState(chatId, 'waiting_username');
      await bot.sendMessage(chatId, 'Please enter your GitHub username:');
      break;

    case 'setrepos':
      setUserInputState(chatId, 'waiting_repos');
      await bot.sendMessage(chatId, 'Please enter repository names (comma separated):');
      break;

    case 'setfile':
      setUserInputState(chatId, 'waiting_file');
      await bot.sendMessage(chatId, 'Please enter the file name to push (default: log.md):');
      break;

    case 'setdelay':
      setUserInputState(chatId, 'waiting_delay');
      await bot.sendMessage(chatId, 'Please enter delay in seconds between pushes:');
      break;

    case 'startpush':
      startPushing(chatId);
      await bot.sendMessage(chatId, 'Auto push started.', mainKeyboard);
      break;

    case 'stoppush':
      stopPushing(chatId);
      await bot.sendMessage(chatId, 'Auto push stopped.', mainKeyboard);
      break;

    case 'status':
      const state = getUserState(chatId);
      const status = `
Status:
GitHub Token: ${state.githubToken ? 'Set' : 'Not set'}
GitHub Username: ${state.username || 'Not set'}
Repos: ${state.repos.length > 0 ? state.repos.join(', ') : 'Not set'}
File: ${state.file}
Delay: ${state.delay} seconds
Bot Running: ${state.pushing ? 'Yes' : 'No'}
      `;
      await bot.sendMessage(chatId, status, mainKeyboard);
      break;
  }

  // Answer callback query to remove loading state
  await bot.answerCallbackQuery(callbackQuery.id);
});

// Handle text messages for settings input
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Ignore commands
  if (text.startsWith('/')) return;

  const inputState = getUserInputState(chatId);
  const state = getUserState(chatId);

  if (!inputState) {
    bot.sendMessage(chatId, 'Please use the buttons to control the bot.', mainKeyboard);
    return;
  }

  switch (inputState) {
    case 'waiting_token':
      state.githubToken = text;
      bot.sendMessage(chatId, 'GitHub token set.', settingsKeyboard);
      break;

    case 'waiting_username':
      state.username = text;
      bot.sendMessage(chatId, `GitHub username set to "${text}".`, settingsKeyboard);
      break;

    case 'waiting_repos':
      const repos = text.split(',').map(r => r.trim()).filter(r => r.length > 0);
      if (repos.length === 0) {
        bot.sendMessage(chatId, 'Please provide at least one repo name.', settingsKeyboard);
        break;
      }
      state.repos = repos;
      bot.sendMessage(chatId, `Repos set to: ${repos.join(', ')}`, settingsKeyboard);
      break;

    case 'waiting_file':
      if (text.length === 0) {
        bot.sendMessage(chatId, 'File name cannot be empty.', settingsKeyboard);
        break;
      }
      state.file = text;
      bot.sendMessage(chatId, `File to push set to "${text}".`, settingsKeyboard);
      break;

    case 'waiting_delay':
      const delay = parseInt(text, 10);
      if (isNaN(delay) || delay <= 0) {
        bot.sendMessage(chatId, 'Please provide a valid positive number for delay in seconds.', settingsKeyboard);
        break;
      }
      state.delay = delay;
      bot.sendMessage(chatId, `Delay set to ${delay} seconds.`, settingsKeyboard);
      setUserInputState(chatId, null);
      break;
  }

  // Clear input state after handling
  setUserInputState(chatId, null);
});
