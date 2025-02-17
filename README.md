# Preview Synth Bot

Telegram bot to automatically convert links into embed-friendly ones for Telegram and other messaging platforms. ✨

## About

### Supported commands

#### Public commands

- `/start`
  > Welcomes user to using the bot and gives small usage example.
- `/help`
  > Details usage and lists supported sites.
- `/convert`
  > Converts a link (if supported) into an embed-friendly one for social messaging use.

#### Admin commands

- `/enable {name|origin|destination}`
  > Enables converting a given web link mapping.
- `/disable {name|origin|destination}`
  > Disables converting a given web link mapping.
- `/toggle {name|origin|destination}`
  > Toggles converting a given web link mapping.
- `/save`
  > Saves configuration to disk.
- `/reload`
  > Reloads configuration from disk.

### General use cases

- Private chat with bot, by sending links directly or using the `/convert` command.
- Anywhere on Telegram, by using in-line queries. Begin with the bot's handle (i.e. `@PreviewSynthBot`) followed by a link to convert, then select the command in the list that appears.
- In any type of chats (private, groups, supergroups and channels) by sending links and the bot replying to said link with a converted one.

## Deployment

### Prerequisites

- An Internet connection
- A Telegram Bot token (talk to [@BotFather](https://BotFather.t.me) to get one)
- Deno@v2

### Steps

1. Create configuration file (use [config.yaml.example](config.yaml.example) as a complete example)
2. Set environment variables
   > `export TG_PREVIEW_BOT_TOKEN={YOUR_BOT_TOKEN_FROM_@BOTFATHER}` or use `.env` file (use [.env.example](.env.example) as a complete example)
3. Run application
   1. Container
      1. Pull image
         > `docker pull ghcr.io/campfred/tg-previewsynth-bot:main`
      2. Run image
         > With env variable : `docker run campfred/tg-previewsynth-bot --read-only --volume $PWD/config.yaml:/app/config.yaml --env TG_PREVIEW_BOT_TOKEN=$TG_PREVIEW_BOT_TOKEN`
         > With .env file : `docker run campfred/tg-previewsynth-bot --read-only --volume $PWD/config.yaml:/app/config.yaml --read-only --volume $PWD/.env:/app/.env`
   2. Local
      1. Install dependancies
         > `deno task install`
      2. Run app
         > `deno task start`
4. Use it!

## Upcoming improvements

- Administration commands
  - Toggle website status
  - Toggle link recognition
  - Save configuration to file
