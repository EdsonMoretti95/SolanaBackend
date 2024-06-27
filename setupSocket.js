const socketIO = require('socket.io');
const app = require('./app');
const { sendAndConfirmTransaction, sendWinnerPrize } = require('./blockchain');
const { getIO, init } = require('./socket');

function listUsers(){
    return Object.keys(app.locals.gameUsers).map(key => ({
        id: key,
        status: app.locals.gameUsers[key]
    }));
}

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
                    if(keys.length === app.locals.playerSlots && keys.every(key => app.locals.gameUsers[key] === 1)){
                        io.emit('toast', 'all players joined, picking winner in 5 seconds');
                        new Promise(r => setTimeout(r, 5000)).then(() => {
                            const keys = Object.keys(app.locals.gameUsers);
                            let winnerIndex = Math.floor(Math.random() * keys.length);
                            console.log('the winner is ' + keys[winnerIndex]);
                            io.emit('winner', `${keys[winnerIndex]}`);
                            sendWinnerPrize(keys[winnerIndex], keys.length * 50);
                            new Promise(r => setTimeout(r, 10000)).then(() => {                                
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

module.exports = { setupSocket };