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
        console.log(`a user connected ${socket.id}`);
        new Promise(r => setTimeout(r, 2000)).then(() => {
            console.log('sending list of users');
            io.to(socket.id).emit('updateUsers', listUsers());
        });        
    
        // user connects, add him to list of players and broadcast the change
        socket.on('join', (join) => {
            console.log(`user ${socket.id} - ${join} joined the game`);
            app.locals.gameUsers[join] = 0;
            console.log(app.locals.gameUsers);
            io.emit('updateUsers', listUsers());
            new Promise(r => setTimeout(r, 120000)).then(() => {
                delete app.locals.gameUsers[join];
                io.to(socket.id).emit('updateUsers', listUsers());
            });              

        })
    
        socket.on('disconnect', () => {
            console.log(`user disconnected ${socket.id}`);
        });
    
        socket.on('message', (msg) => {
            console.log('message: ' + msg);
            io.emit('message', msg);
        });
    
        socket.on('payTransaction', (userTransaction) => {
            console.log('payTransaction received for ' + userTransaction.id);
            sendAndConfirmTransaction(userTransaction.transaction).then((result) => {
                if(result){
                    app.locals.gameUsers[userTransaction.id] = 1;
                }else{
                    delete app.locals.gameUsers[userTransaction.id];
                }
                
                io.to(socket.id).emit('paymentReceived');
                io.emit('updateUsers', listUsers());
            })
        })
    });
}

module.exports = { setupSocket };