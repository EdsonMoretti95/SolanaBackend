const app = require('./app');
const { sendAndConfirmTransaction, sendWinnerPrize } = require('./blockchain');
const { init } = require('./socket');
const TelegramBot = require('node-telegram-bot-api');

const token = '6904926750:AAHChjqlZQlpzkVcXOOCWE9Hlu3B-Amjl6Y';
const bot = new TelegramBot(token, {polling: true});
const chatId = '-1002169181680';
const winnerImg = './winner.jpg';
const spinImg = './Spin.gif';

let gameInterval = 0;
let gameMessageId = null;

function listUsers(){
    return Object.keys(app.locals.gameUsers).map(key => ({
        id: key,
        status: app.locals.gameUsers[key]
    }));
}

bot.onText(/\/game/, function onPhotoText(msg) {
    bot.sendMessage(chatId, 'coming soon!');
});

function setupSocket(server) {
    const io = init(server);

    io.on('connection', (socket) => {
        // user connects, send him the list of connected players
        new Promise(r => setTimeout(r, 2000)).then(() => {
            io.to(socket.id).emit('updateUsers', listUsers());
        });        
    
        // user connects, add him to list of players and broadcast the change
        socket.on('join', (join) => {
            const keys = Object.keys(app.locals.gameUsers);                        
            if(keys.length === app.locals.playerSlots){
                io.to(socket.id).emit('toast', 'slots are full, cannot join now, wait for next game');
                return;
            }

            if(keys.includes(join)){
                io.to(socket.id).emit('toast', `can't join twice, wait transaction timeout (2 minutes) and try again`);
                return;
            }

            console.log(`user ${socket.id} - ${join} joined the game`);
            app.locals.gameUsers[join] = 0;
            io.emit('updateUsers', listUsers());
            new Promise(r => setTimeout(r, 120000)).then(() => {
                console.log('player join event after timeout');
                if(app.locals.gameUsers[join] === 0){
                    delete app.locals.gameUsers[join];
                    io.emit('updateUsers', listUsers());
                }
            }); 
        })

        socket.on('remove', (wallet) => {
            const keys = Object.keys(app.locals.gameUsers);
            if(keys.includes(wallet)){
                delete app.locals.gameUsers[wallet];
                io.emit('updateUsers', listUsers());
            }
        })
       
        socket.on('message', (msg) => {
            console.log('message: ' + msg);
            io.emit('message', msg);
        });
    
        socket.on('payTransaction', (userTransaction) => {
            console.log('payTransaction received for ' + userTransaction.id);
            sendAndConfirmTransaction(userTransaction.transaction).then((result) => {
                if(result){
                    app.locals.gameUsers[userTransaction.id] = 1;
                    const keys = Object.keys(app.locals.gameUsers);
                    if(keys.length < app.locals.playerSlots){
                        updateGameMessagePeriodically();
                    }

                    if(keys.length === app.locals.playerSlots && keys.every(key => app.locals.gameUsers[key] === 1)){
                        io.emit('toast', 'all players joined, picking winner in 5 seconds');
                        clearInterval(gameInterval);
                        gameMessageId = null;
                        new Promise(r => setTimeout(r, 5000)).then(() => {
                            const keys = Object.keys(app.locals.gameUsers);
                            let winnerIndex = Math.floor(Math.random() * keys.length);
                            console.log('the winner is ' + keys[winnerIndex]);
                            io.emit('winner', `${keys[winnerIndex]}`);
                            sendWinnerPrize(keys[winnerIndex], keys.length * 50);
                            new Promise(r => setTimeout(r, 15000)).then(() => {
                                bot.sendPhoto(chatId, winnerImg, { caption:
`🎉 *Winner Winner Chicken Dinner* 🎉 

${keys[winnerIndex]} 

just won *${keys.length * 50} $Horny* tokens on the Horny Wheel Game\\!`, parse_mode: 'MarkdownV2'});
                                app.locals.gameUsers = [];
                                io.emit('updateUsers', []);
                            });
                        });
                    }
                }else{
                    delete app.locals.gameUsers[userTransaction.id];
                    io.emit('updateUsers', listUsers());
                }
                
                io.to(socket.id).emit('paymentReceived');
                io.emit('updateUsers', listUsers());
            })
        })
    });
}

const createProgressBar = (current, total) => {
    const progress = Math.round((current / total) * 10);
    const greenBar = '🍆'.repeat(progress); // Green blocks
    const emptyBar = '⬜'.repeat(10 - progress); // White blocks
    return `${greenBar}${emptyBar}`;
};

const sendGameMsg = () => {
    let playersJoined = Object.keys(app.locals.gameUsers).length;
    let playersNeeded = app.locals.playerSlots;

    if(gameMessageId) {
        bot.deleteMessage(chatId, gameMessageId);
    }        

    if (playersJoined < playersNeeded) {
        const progressBar = createProgressBar(playersJoined, playersNeeded);
        const message = 
`🎉🔥 *GAME ALERT* 🔥🎉

*Horny Degens* are waiting for you to start a game!
Grab your chance to win BIG!
*${playersJoined}* joined out of *${playersNeeded}*
${progressBar}

🍀🍀 [Join Now!](www.hornydegens.com) 🍀🍀`;
        bot.sendAnimation(chatId, spinImg, { caption: message, parse_mode: 'Markdown' }).then((messageInfo) => {
            gameMessageId = messageInfo.message_id;
        });          
    }
}

const updateGameMessagePeriodically = () => {
    sendGameMsg();
    gameInterval = setInterval(() => sendGameMsg, 20000);
};

module.exports = { setupSocket };