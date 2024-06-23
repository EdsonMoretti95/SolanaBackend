const { sendWinnerPrize } = require('./blockchain');
const { getIO } = require('./socket');

function setupAPIs(app){
    const io = getIO();

    app.post('/clearPlayers', (req, res) => {
        app.locals.gameUsers = [];
        io.emit('updateUsers', []);
        console.log('cleared users');
        res.status(200).send('Users cleared');
    });    

    app.post('/selectWinner', (req, res) => {
        const keys = Object.keys(app.locals.gameUsers);
        let winnerIndex = Math.floor(Math.random() * keys.length);
        console.log(winnerIndex);
        console.log(keys[winnerIndex]);
        io.emit('toast', `The winner is ${keys[winnerIndex]}`);
        new Promise(r => setTimeout(r, 2000)).then(() => {
            sendWinnerPrize(keys[winnerIndex], keys.length * 50);
        });
        
        res.status(200).send(`Winner is ${'test'}`);
    })
}

module.exports = {setupAPIs};