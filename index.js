const http = require('http');
const app = require('./app');
const { setupSocket } = require('./setupSocket');
const { setupAPIs } = require('./restapis');

const server = http.createServer(app);
app.locals.gameUsers = {};
setupSocket(server);
setupAPIs(app);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});