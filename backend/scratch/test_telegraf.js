const { Telegraf } = require('telegraf');
const token = '8764826903:AAF8b81R4yIt3ibB2SBQbN9DSa8ZDlECDt8';

const bot = new Telegraf(token);

bot.start((ctx) => ctx.reply('Welcome'));
bot.on('text', (ctx) => {
    console.log('Message:', ctx.message.text);
    ctx.reply('I heard: ' + ctx.message.text);
});

console.log('Launching test bot...');
bot.launch()
    .then(() => console.log('Bot launched!'))
    .catch(err => console.error('Launch failed:', err));
