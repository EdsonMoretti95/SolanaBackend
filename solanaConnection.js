const { Connection } = require('@solana/web3.js');

// Create a connection to the Solana cluster
const connection = new Connection("https://evocative-sparkling-leaf.solana-mainnet.quiknode.pro/79735600ada1b45856cc7a3835686c46503cef48/", 'confirmed');

module.exports = connection;