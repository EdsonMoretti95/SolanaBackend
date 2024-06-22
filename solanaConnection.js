const { Connection } = require('@solana/web3.js');

// Create a connection to the Solana cluster
const connection = new Connection("https://fancy-daphna-fast-mainnet.helius-rpc.com/", 'confirmed');

module.exports = connection;