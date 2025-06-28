# Auto Push GitHub Bot by Telegram

This is a Node.js Telegram bot that automatically pushes a specified file to one or more GitHub repositories at a set interval. The bot is controlled via Telegram inline buttons and supports multiple users independently.

Auto Push GitHub Bot by [Telegram](https://t.me/GitHubAutoPushbot)

![](screenshot.png)

## Features

- Set GitHub Token, Username, Repo(s) sequentially via guided prompts
- Specify file to push (default: log.md)
- Set delay between pushes (seconds)
- Start and stop the bot
- Runs continuously until stopped
- Supports multiple Telegram users independently
- User-friendly interface with Telegram inline buttons

## Setup

1. Clone this repository:
```bash
git clone https://github.com/xsrazy/GitHub-Auto-Push-by-Telegram.git
cd GitHub-Auto-Push-by-Telegram
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file and add your Telegram Bot Token:
```
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
```

4. Run the bot:
```bash
npm start
```

## Usage

Use the Telegram inline buttons to control the bot. The bot will guide you through setting up your GitHub token, username, repositories, file, and delay sequentially.

Main buttons:

- ⚙️ Settings
- ▶️ Start Push
- ⏹️ Stop Push
- 📊 Status

Settings buttons:

- 🔑 Set GitHub Token
- 👤 Set Username
- 📁 Set Repos
- 📄 Set File
- ⏱️ Set Delay
- 🔙 Back to Main Menu

## Notes

- The bot writes a message with the current WIB (GMT+7) time into the file before pushing
- Each user's settings and push operations are independent
- Make sure the file to push exists in the bot's directory

## Deploy to VPS/Terminal

1. Upload the files to your VPS:
```bash
scp -r auto-push-bot/* user@your-vps:/path/to/deploy
```

2. SSH into your VPS:
```bash
ssh user@your-vps
```

3. Navigate to the bot directory:
```bash
cd /path/to/deploy
```

4. Install dependencies and start the bot:
```bash
npm install
npm start
```

For running the bot continuously, you can use PM2:
```bash
npm install -g pm2
pm2 start bot.js
```

## Credits

Created by [Xsrszy](https://github.com/xsrazy)
