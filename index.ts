import { Context, Telegraf, type NarrowedContext } from 'telegraf';
import { type Place, type Data } from './types';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { CronJob } from 'cron';
import type { Update, CallbackQuery } from 'telegraf/types';


const MAX_MESSAGE_LENGHT = 4000;
const placeShort = {
    "Воробкевича": "ВБ",
    "Проспект": "ПР",
    "Шептицького": "ШЕПТ"
}



let data: Data;
readData();
let waitingForMessage: "PAYMENT" | `SALES@${string}` | "ADD_DAY_DATE" | "ADD_DAY_PLACE" | null = null;
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

    let total = 0;

    for (let i = 0; i < data.sales.length; i++) {
        const salary = data.sales[i].sales * data.stakes[data.sales[i].place].percent / 100 + data.stakes[data.sales[i].place].stake;
        total += salary;
        message += `${data.sales[i].date}@${placeShort[data.sales[i].place]} - ${salary.toFixed(2)}\n`;
    }

    const longestRow = Math.max(...message.split('\n').map(row => row.length));

    message += "-".repeat(longestRow) + "\n";
    message += `Всього: ${total.toFixed(2)}\n`;

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

    const messageParts = splitMessage(message)

    for (const messagePart of messageParts) {
        ctx.reply(messagePart, { parse_mode: "Markdown" })
    }
});

bot.command('payment', (ctx) => {
    if (ctx.chat?.id != parseInt(process.env.ME_ID!)) {
        ctx.reply('Но-но-но містер фіш, тобі сюда нізя!');
        return;
    }

    waitingForMessage = "PAYMENT";
    ctx.reply("Шо тобі дали, старига?");
});

bot.command('payments', (ctx) => {
    if (ctx.chat?.id != parseInt(process.env.ME_ID!)) {
        ctx.reply('Но-но-но містер фіш, тобі сюда нізя!');
        return;
    }

    let message = "`";

    for (const payment of data.payments) {
        message += `${payment.toFixed(2)}\n`;
    }

    message += "`";

    ctx.reply(`${message}`, { parse_mode: 'Markdown' });
});

bot.command(['cancel'], (ctx) => {
    if (ctx.chat?.id != parseInt(process.env.ME_ID!)) {
        ctx.reply('Но-но-но містер фіш, тобі сюда нізя!');
        return;
    }

    waitingForMessage = null;
    place = null;
    ctx.reply("Окей", {
        reply_markup: {
            remove_keyboard: true
        }
    });
});

bot.command('edit', (ctx) => {
    if (ctx.chat?.id != parseInt(process.env.ME_ID!)) {
        ctx.reply('Но-но-но містер фіш, тобі сюда нізя!');
        return;
    }

    ctx.reply("Шо нада?", {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Додати день', callback_data: 'EDIT_ADD_DAY' }],
                [{ text: 'Видалити день', callback_data: 'EDIT_DELETE_DAY' }],
                [{ text: 'Видалити виплату', callback_data: 'EDIT_DELETE_PAYMENT' }],
            ],
            resize_keyboard: true,
            one_time_keyboard: true
        }
    });
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


    if (waitingForMessage === "PAYMENT") {
        if (!message) {
            ctx.reply("Введіть суму виплати");
            return;
        }

        const payment = parseFloat(message);

        if (isNaN(payment) || payment < 0) {
            ctx.reply("🤡");
            return;
        }

        data.payments.push(payment);
        updateData();

        ctx.reply("Виплату додано");
        waitingForMessage = null;
    } else if (waitingForMessage.startsWith("SALES@")) {
        if (!message) {
            ctx.reply("Їблан?");
            return;
        }

        if (!place) {
            ctx.reply("Їблан, точку вибери");
            return;
        }

        const salesAmount = parseFloat(message);

        if (isNaN(salesAmount) || salesAmount < 0) {
            ctx.reply("🤡");
            return;
        }

        const date = waitingForMessage.split('@')[1];
        data.sales.push({ date, sales: salesAmount, place: place! });
        sortData();
        updateData();

        ctx.reply("Хрш, до завтра!");
        waitingForMessage = null;
        place = null;
    } else if (waitingForMessage === "ADD_DAY_DATE") {
        if (!message) {
            ctx.reply("Введи даду в форматі дд/мм/рррр");
            return;
        }

        const day = +message.split('/')[0];
        const month = +message.split('/')[1];
        const year = +message.split('/')[2];

        if (isNaN(day) || isNaN(month) || isNaN(year)) {
            ctx.reply("Їблан, норм дату введи в форматі дд/мм/рррр");
            return;
        }

        const date = new Date(year, month - 1, day).toLocaleString('en-GB', { timeZone: 'Europe/Kiev' }).split(',')[0];

        if (date === 'Invalid Date') {
            ctx.reply("Їблан, норм дату введи в форматі дд/мм/рррр");
            return;
        }

        waitingForMessage = `SALES@${date}`;

        ctx.reply(`Їбашу для ${date}`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Воробкевича', callback_data: 'VB' }],
                    [{ text: 'Проспект', callback_data: 'PR' }],
                    [{ text: 'Шептицького', callback_data: 'SH' }]
                ],
                resize_keyboard: true,
                one_time_keyboard: true
            }
        })
    }
});



bot.on('callback_query', async (ctx) => {
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
    } else if (callbackData.startsWith('EDIT_')) {
        handleEditCallback(ctx, callbackData);
    } else if (callbackData.startsWith('DELETE_DAY:')) {
        const index = parseInt(callbackData.split(':')[1]);
        data.sales.splice(index, 1);
        updateData();
        ctx.reply("Заїбісь, видалено");
        ctx.deleteMessage();
    } else if (callbackData.startsWith('DELETE_PAYMENT:')) {
        const index = parseInt(callbackData.split(':')[1]);
        data.payments.splice(index, 1);
        updateData();
        ctx.reply("Заїбісь, видалено");
        ctx.deleteMessage();
    } else {
        ctx.reply(`Бля шось не то: callbackData: ${callbackData}`);
    }

    bot.telegram.answerCbQuery(ctx.callbackQuery.id);
});






function readData() {
    data = JSON.parse(fs.readFileSync('data.json', 'utf-8'));
}

function updateData() {
    fs.writeFileSync('data.json', JSON.stringify(data, null, 4));
}


function sortData() {
    data.sales = data.sales.sort((a, b) => (new Date(a.date).getTime()) - (new Date(b.date).getTime()));
}



async function handleEditCallback(ctx: NarrowedContext<Context<Update>, Update.CallbackQueryUpdate<CallbackQuery>>, callbackData: string) {
    switch (callbackData.split(":")[0]) {
        case "EDIT_ADD_DAY":
            ctx.reply("Введіть дату", {
                reply_markup: {
                    remove_keyboard: true
                }
            });
            waitingForMessage = "ADD_DAY_DATE";
            ctx.editMessageReplyMarkup(undefined);
            break;


        case "EDIT_DELETE_DAY": {
            const parts = callbackData.split(":");
            const page = parts[1];
            const direction = parts[2];
        
            if (page !== undefined && direction !== undefined) {
                const nextPage = +page + (direction === "next" ? -1 : 1);
        
                await ctx.editMessageReplyMarkup({
                    inline_keyboard: generateDataKeyboard(
                        "{date}@{shortPlace}:{sales}",
                        "DELETE_DAY:{index}",
                        "EDIT_DELETE_DAY",
                        nextPage
                    ),
                });
                
                return;
            } else {
                await ctx.reply("Виберіть день для видалення", {
                    reply_markup: {
                        inline_keyboard: generateDataKeyboard(
                            "{date}@{shortPlace}:{sales}",
                            "DELETE_DAY:{index}",
                            "EDIT_DELETE_DAY",
                            0
                        ),
                    },
                });

                ctx.answerCbQuery("Hui")
                return;
            }
        }


        case "EDIT_DELETE_PAYMENT":
            if (data.payments.length === 0) {
                ctx.reply("Немає виплат для видалення");
                return;
            }

            const keyboard = data.payments.map((payment, index) => {
                return [{ text: `${payment}`, callback_data: `DELETE_PAYMENT:${index}` }];
            });

            ctx.reply("Виберіть виплату для видалення", {
                reply_markup: {
                    inline_keyboard: keyboard,
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            });
            break

        

        default:
            ctx.reply(`Бля шось не то: ${callbackData}`)
    }

    ctx.answerCbQuery();
}



function getInterval(from: Date, to?: Date) {
    if (!to) {
        to = new Date();
    }

    return data.sales.filter(sale => {
        const date = parseDate(sale.date)
        return date.getTime() >= from.getTime() && date.getTime() <= to!.getTime();
    });
}


function parseDate(str: string) {
    const parts = str.split('/');
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1; // Months are zero-based in JavaScript
    const year = parseInt(parts[2]);

    return new Date(year, month, day);
}


function splitMessage(message: string): string[] {
    if (message.length < MAX_MESSAGE_LENGHT)
        return [message];

    const lines = message.split("\n");

    let partIndex = 0;

    const parts = [""];

    for (let line of lines) {
        if (parts[partIndex].length + line.length + 1 > MAX_MESSAGE_LENGHT) {
            partIndex++;
            parts.push("");
        }

        parts[partIndex] += line + "\n";
    }

    for (let i in parts) {
        parts[i] = parts[i].trim();
    }


    return parts;
}


/**
 * {date} {place} {shortPlace} {sales} {index}
 * @param textTemplate 
 * @param callbackTemplate 
 * @returns 
 */
function generateFullDataKeyboard(textTemplate: string, callbackTemplate: string) {
    return data.sales.map((day, index) => {
        let text = textTemplate
            .replaceAll("{date}", day.date)
            .replaceAll("{place}", day.place)
            .replaceAll("{shortPlace}", placeShort[day.place])
            .replaceAll("{sales}", `${day.sales}`)
            .replaceAll("{index}", `${index}`);

        let callback_data = callbackTemplate 
            .replaceAll("{date}", day.date)
            .replaceAll("{place}", day.place)
            .replaceAll("{shortPlace}", placeShort[day.place])
            .replaceAll("{sales}", `${day.sales}`)
            .replaceAll("{index}", `${index}`);


        return [{text, callback_data}]

        
    })
}


/**
 *  * {date} {place} {shortPlace} {sales} {index}
 * @param textTemplate 
 * @param callbackItemTemplate 
 * @param navigationCallback Callback on navigation buttons: `{navigationCallback}:{page}:next` | `{navigationCallback}:{page}:back`
 * @param page 
 * @returns 
 */
function generateDataKeyboard(textTemplate: string, callbackItemTemplate: string, navigationCallback: string, page: number) {
    const sales = data.sales;

    const offset = data.sales.length - page * 10 - 10

    const keyboard = generateFullDataKeyboard(textTemplate, callbackItemTemplate)
        .slice(offset < 0 ? 0 : offset, offset + 10)


    const navigation = []

    if (offset > 0) {
        navigation.push({text: "Prev", callback_data: `${navigationCallback}:${page}:prev`})
    }

    if (offset < data.sales.length - 10) {
        navigation.push({text: "Next", callback_data: `${navigationCallback}:${page}:next`})
    } 

    keyboard.push(navigation)


    return keyboard;

}

const job = new CronJob('0 23 * * *', () => {
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

