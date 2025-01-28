import { Telegraf } from 'telegraf';
import { type Place, type Data } from './types';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { CronJob } from 'cron';


let data: Data;
readData();
let waitingForMessage: "PREPAYMENT" | "PAYMENT" | `SALES@${string}` | null = null;
let place: Place | null = null;

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN!);

bot.start((ctx) => {
    if (ctx.chat?.id != parseInt(process.env.ME_ID!)) {
        ctx.reply('Но-но-но містер фіш, тобі сюда нізя!');
        return;
    }

    ctx.reply("Sup");
});

bot.command(['summary'], (ctx) => {
    if (ctx.chat?.id != parseInt(process.env.ME_ID!)) {
        ctx.reply('Но-но-но містер фіш, тобі сюда нізя!');
        return;
    }

    let message = "`"

    const sales = Array.from(data.sales, day => day.sales);
    const longestSales = Math.max(...sales.map(sale => sale.toFixed(2).length));

    let total = 0;

    for (let i = 0; i < data.sales.length; i++) {
        const salary = data.sales[i].sales * data.stakes[data.sales[i].place].percent / 100 + data.stakes[data.sales[i].place].stake;
        total += salary;
        message += `${data.sales[i].date} : ${sales[i].toFixed(2).padEnd(longestSales)} - ${salary.toFixed(2)}\n`;
    }

    const longestRow = Math.max(...message.split('\n').map(row => row.length));

    message += "-".repeat(longestRow) + "\n";
    message += `Всього: ${total.toFixed(2)}\n`;

    let prepayments = 0
    for (const prepayment of data.prepayments) {
        total -= prepayment;
        prepayments += prepayment;
    }

    message += "-".repeat(longestRow) + "\n";
    message += `Аванс: ${prepayments.toFixed(0)}\n`;

    let payments = 0;
    for (const payment of data.payments) {
        total -= payment;
        payments += payment;
    }

    if (payments != 0) {
        message += "-".repeat(longestRow) + "\n";
        message += `Виплати: ${payments.toFixed(2)}\n`;
    }

    message += "-".repeat(longestRow) + "\n";
    message += `Борг: ${total.toFixed(2)}\n`;

    message += "`";

    ctx.reply(`${message}`, { parse_mode: 'Markdown' });
});

bot.command(['prepayment'], (ctx) => {
    if (ctx.chat?.id != parseInt(process.env.ME_ID!)) {
        ctx.reply('Но-но-но містер фіш, тобі сюда нізя!');
        return;
    }

    waitingForMessage = "PREPAYMENT";
    ctx.reply("Введіть суму авансу");
});

bot.command('prepayments', (ctx) => {
    if (ctx.chat?.id != parseInt(process.env.ME_ID!)) {
        ctx.reply('Но-но-но містер фіш, тобі сюда нізя!');
        return;
    }

    let message = "`";
    for (const prepayment of data.prepayments) {
        message += `${prepayment.toFixed(2)}\n`;
    }
    message += "`";

    ctx.reply(`${message}`, { parse_mode: 'Markdown' });
});

bot.on("message", (ctx) => {
    if (ctx.chat?.id != parseInt(process.env.ME_ID!)) {
        ctx.reply('Но-но-но містер фіш, тобі сюда нізя!');
        return;
    }

    if (!waitingForMessage) {
        return;
    }

    const message = ctx.text;

    if (waitingForMessage === "PREPAYMENT") {
        if (!message) {
            ctx.reply("Введіть суму авансу");
            return;
        }

        const prepayment = parseFloat(message);

        if (isNaN(prepayment) || prepayment < 1) {
            ctx.reply("Це не число або число менше 1");
            return;
        }

        data.prepayments.push(prepayment);
        updateData();

        ctx.reply("Аванс додано");
        waitingForMessage = null;
    } else if (waitingForMessage === "PAYMENT") {
        if (!message) {
            ctx.reply("Введіть суму виплати");
            return;
        }

        const payment = parseFloat(message);

        if (isNaN(payment) || payment < 1) {
            ctx.reply("Це не число або число менше 1");
            return;
        }

        data.payments.push(payment);
        updateData();

        ctx.reply("Виплату додано");
        waitingForMessage = null;
    } else if (waitingForMessage.startsWith("SALES@")) {
        if (!message) {
            ctx.reply("Введіть суму продажу");
            return;
        }

        if (!place) {
            ctx.reply("Їблан, точку вибери");
            return;
        }

        const salesAmount = parseFloat(message);

        if (isNaN(salesAmount) || salesAmount < 1) {
            ctx.reply("Це не число або число менше 1");
            return;
        }

        const date = waitingForMessage.split('@')[1];
        data.sales.push({ date, sales: salesAmount, place: place! });
        updateData();

        ctx.reply("Хрш, до завтра!");
        waitingForMessage = null;
        place = null;
    }
});
const job = new CronJob('30 23 * * *', () => {
    bot.telegram.sendMessage(process.env.ME_ID!, 'Шо ти як? Де сьогодні був?', {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Відпочивав', callback_data: 'DAY_OFF' }],
                [{ text: 'Воробкевича', callback_data: 'VB' }],
                [{ text: 'Проспект', callback_data: 'PR' }],
                [{ text: 'Шептицького', callback_data: 'SH' }]
            ],
            resize_keyboard: true,
            one_time_keyboard: true
        }
    });

    const kyivTime = new Date().toLocaleString('en-GB', { timeZone: 'Europe/Kiev' });
    waitingForMessage = `SALES@${kyivTime.split(',')[0]}`;
    console.log(waitingForMessage);
}, null, true, 'Europe/Kiev');

bot.on('callback_query', (ctx) => {
    //@ts-ignore
    const callbackData = ctx.callbackQuery.data!;
    console.log(callbackData);

    if (!callbackData) {
        return;
    }

    if (callbackData === 'VB') {
        place = 'Воробкевича';
        ctx.reply("Шо по касі?");
        ctx.deleteMessage();
    } else if (callbackData === 'PR') {
        place = 'Проспект';
        ctx.reply("Шо по касі?");
        ctx.deleteMessage();
    } else if (callbackData === 'SH') {
        place = 'Шептицького';
        ctx.reply("Шо по касі?");
        ctx.deleteMessage();
    } else if (callbackData === 'DAY_OFF') {
        ctx.reply("Хрш, лінивець");
        ctx.deleteMessage();
    }

    ctx.answerCbQuery();
});

job.start();

bot.launch();

process.once('SIGINT', () => {
    bot.stop('SIGINT');
    job.stop();
});
process.once('SIGTERM', () => {
    bot.stop('SIGTERM');
    job.stop();
});


function readData() {
    data = JSON.parse(fs.readFileSync('data.json', 'utf-8'));
}

function updateData() {
    fs.writeFileSync('data.json', JSON.stringify(data, null, 4));
}