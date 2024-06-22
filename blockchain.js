const connection = require("./solanaConnection");
const { sendAndConfirmRawTransaction, Keypair, Transaction, PublicKey } = require('@solana/web3.js');
const { Token, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, createTransferInstruction } = require('@solana/spl-token');
const MINT_ADDRESS = '2hnFpwft7BRhh7fcbkqaLzXubn76jNJNSyTZwdtDpump'; 
const NUMBER_OF_DECIMALS = 6;
const privateKey = Uint8Array.from([187,109,116,231,6,179,140,18,160,124,180,24,163,150,111,9,89,8,32,61,52,215,233,146,1,197,204,117,192,199,253,106,72,177,21,53,115,150,232,68,226,62,69,79,62,225,229,4,60,211,130,210,205,95,73,2,82,235,22,123,116,129,71,83]);


async function sendAndConfirmTransaction(signedTransaction){
    let txid;
    try {         
        // Send the transaction
        txid = await connection.sendRawTransaction(signedTransaction, connection);   
        // Confirm the transaction

        const result = await confirmWithPooling(txid);
        return result.status == 'confirmed';
    } catch (error) {
        console.error('Failed to send transaction:', error);
        return false;
    }    
}

async function confirmWithPooling(txid){
    try {
        await connection.confirmTransaction(txid, 'confirmed');
        console.log(`Transaction ${txid} confirmed quickly`);
        return { txid, status: 'confirmed' };
    } catch (error) {
        console.warn(`Initial confirmation attempt for transaction ${txid} failed: ${error.message}`);
    }    

    const startTime = Date.now();
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const timeout = 60000;

    while (Date.now() - startTime < timeout) {
        await sleep(2000); // Poll every 2 seconds

        const status = await connection.getSignatureStatuses([txid]);
        const statusInfo = status && status.value && status.value[0];

        if (statusInfo) {
            if (statusInfo.confirmationStatus === 'confirmed' || statusInfo.confirmationStatus === 'finalized') {
                console.log(`Transaction ${txid} confirmed`);
                return { txid, status: statusInfo.confirmationStatus };
            } else if (statusInfo.err) {
                return { txid, status: statusInfo.confirmationStatus }
            }
        }
    }    

    return { txid, status: 'timeout' };
}

async function sendWinnerPrize(winnerAddress, winnerAmount){    
    const payer = Keypair.fromSecretKey(privateKey);
    const destPublicKey = new PublicKey(winnerAddress);
    const mintPublicKey = new PublicKey(MINT_ADDRESS);

    let sourceAccount = await getAssociatedTokenAddressSync(
        new PublicKey(MINT_ADDRESS), 
        payer.publicKey, 
        false
    );
  
    let destinationAccount = await getAssociatedTokenAddressSync(
        new PublicKey(MINT_ADDRESS), 
        new PublicKey(winnerAddress), 
        false
    );

    const tx = new Transaction();
    tx.add(createTransferInstruction(
        sourceAccount,
        destinationAccount,
        payer.publicKey,
        winnerAmount * Math.pow(10, NUMBER_OF_DECIMALS)
    ));

    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.feePayer = payer.publicKey;

    try {
        const signature = await connection.sendTransaction(tx, [payer], { skipPreflight: false, preflightCommitment: 'confirmed' });
        const result = await confirmWithPooling(signature);        
        return result.status == 'confirmed';              
    } catch (error) {
        console.error('Failed to send winner transaction:', error);
        return false;
    }         
}

module.exports = { sendAndConfirmTransaction, sendWinnerPrize };