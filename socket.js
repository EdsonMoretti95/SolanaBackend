// socket.js
let io;

function init(server) {
    const socketIO = require('socket.io');
    io = socketIO(server, {
        cors: {
            origin: "*"
        },
        pingInterval: 10000,
        pingTimeout: 5000,
    });
    return io;
}
function getIO() {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
}

module.exports = { init, getIO }