const app = require('./app');
const { sendAndConfirmTransaction, sendWinnerPrize } = require('./blockchain');
const { init, getIO } = require('./socket');
const TelegramBot = require('node-telegram-bot-api');

const token = '6904926750:AAHChjqlZQlpzkVcXOOCWE9Hlu3B-Amjl6Y';
const bot = new TelegramBot(token, {polling: true});
const chatId = '-1002169181680';
const winnerImg = './winner.jpg';
const spinImg = './Spin.gif';

let gameInterval = null;
let gameMessageId = null;

let gameStartDate = null;
let gameEntryFee = 50;
let gameMinutes = 0;
let gameStatus = 0;

function getGameState(){
    var users = Object.keys(app.locals.gameUsers).map(key => ({
        id: key,
        status: app.locals.gameUsers[key]
    }));

    return {
        status: gameStatus,
        entryValue: gameEntryFee,
        users: users
    };
}

bot.onText(/\/startgame (\S+) (\S+)/, (msg, p) => {
    if(gameStatus === 1){
        bot.sendMessage(chatId, `There's a game running already, wait for it finish before starting a new one`);
    }

    try {
        const feeAmount = Number.parseInt(p[1]);
        const timeMinutes = Number.parseInt(p[2]);

        console.log(`timeMinutes ${timeMinutes}`);
        gameMinutes = timeMinutes;
        gameEntryFee = feeAmount;
        gameStartDate = Date.now();
        gameStatus = 1;
        setTimeout(startGame, timeMinutes * 60000);
        updateGameMessagePeriodically();
        bot.deleteMessage(chatId, msg.message_id);
        const io = getIO();
        io.emit('updateUsers', getGameState());
    } catch (error) {
        bot.sendMessage(chatId, 'error processing the command');
    }
});

bot.onText(/\/startgame$/, (msg, p) => {
    bot.sendMessage(chatId, `Send me a message containing the entry fee amount and the time in minutes, "/startgame 50 15" for a game costing 50 tokens starting in 15 minutes`);
});

function startGame(){
    if(gameMessageId) {
        bot.deleteMessage(chatId, gameMessageId);
        gameMessageId = null;
    }

    const io = getIO();
    clearInterval(gameInterval);
    gameInterval = null;
    gameMessageId = null;
    gameStatus = 0;

    const keys = Object.keys(app.locals.gameUsers);
    if(keys.length === 0){
        bot.sendMessage(chatId, `Game finished wihout any players`);
        app.locals.gameUsers = {};
        io.emit('updateUsers', getGameState());        
        return;
    }

    new Promise(r => setTimeout(r, 5000)).then(() => {        
        let winnerIndex = Math.floor(Math.random() * keys.length);
        console.log('the winner is ' + keys[winnerIndex]);
        io.emit('winner', `${keys[winnerIndex]}`);
        sendWinnerPrize(keys[winnerIndex], keys.length * gameEntryFee);
        new Promise(r => setTimeout(r, 15000)).then(() => {
            bot.sendPhoto(chatId, winnerImg, { caption:
`🎉 *Winner Winner* 🎉 

${keys[winnerIndex]} 

just won *${keys.length * gameEntryFee} $Horny* tokens on the Horny Wheel Game\\!`, parse_mode: 'MarkdownV2'});
            app.locals.gameUsers = {};
            io.emit('updateUsers', getGameState());
        });
    });
};

function setupSocket(server) {
    const io = init(server);

    io.on('connection', (socket) => {
        // user connects, send him the list of connected players
        new Promise(r => setTimeout(r, 2000)).then(() => {
            io.to(socket.id).emit('updateUsers', getGameState());
        });        
    
        // user connects, add him to list of players and broadcast the change
        socket.on('join', (join) => {
            if(gameStatus === 0){
                io.to(socket.id).emit('toast', `No game is running, contact admins on telegram to start a game`);
            }

            const keys = Object.keys(app.locals.gameUsers);                        
            if(keys.length >= app.locals.playerSlots){
                io.to(socket.id).emit('toast', 'slots are full, cannot join now, wait for next game');
                return;
            }

            if(keys.includes(join)){
                io.to(socket.id).emit('toast', `can't join twice, wait transaction timeout (2 minutes) and try again`);
                return;
            }            

            console.log(`user ${socket.id} - ${join} joined the game`);
            app.locals.gameUsers[join] = 0;
            io.emit('updateUsers', getGameState());
            new Promise(r => setTimeout(r, 120000)).then(() => {
                console.log('player join event after timeout');
                if(app.locals.gameUsers[join] === 0){
                    delete app.locals.gameUsers[join];
                    io.emit('updateUsers', getGameState());
                }
            }); 
        })

        socket.on('remove', (wallet) => {
            const keys = Object.keys(app.locals.gameUsers);
            if(keys.includes(wallet)){
                delete app.locals.gameUsers[wallet];
                io.emit('updateUsers', getGameState());
            }
        })
       
        socket.on('message', (msg) => {
            console.log('message: ' + msg);
            io.emit('message', msg);
        });
    
        socket.on('payTransaction', (userTransaction) => {
            console.log('payTransaction received for ' + userTransaction.id);
            const keys = Object.keys(app.locals.gameUsers);

            // don't charge a user if he is not added to the game, don't charge a user twice if he is already in the game and confirmed
            if(!keys.includes(userTransaction.id) || (keys.includes(userTransaction.id) && app.locals.gameUsers[userTransaction.id] === 1)) return;

            sendAndConfirmTransaction(userTransaction.transaction).then((result) => {
                if(result){
                    app.locals.gameUsers[userTransaction.id] = 1;                    
                }else{
                    delete app.locals.gameUsers[userTransaction.id];
                }
                
                io.to(socket.id).emit('paymentReceived');
                io.emit('updateUsers', getGameState());
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

🍀🍀 [Join Now!](www.hornydegens.com) 🍀🍀

Entry fee is *${gameEntryFee} $Horny*
The game will start in *${gameMinutes - getRemainingGameTime()} minutes*`;
        bot.sendAnimation(chatId, spinImg, { caption: message, parse_mode: 'Markdown' }).then((messageInfo) => {
            gameMessageId = messageInfo.message_id;
        });          
    }
}

const updateGameMessagePeriodically = () => {
    sendGameMsg();
    gameInterval = setInterval(() => sendGameMsg(), 60000);
};

const getRemainingGameTime = () => {
    let elapsed = Date.now() - gameStartDate;
    return Math.floor(elapsed / 60000);
}

module.exports = { setupSocket };