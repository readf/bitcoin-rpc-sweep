

const argv = require('minimist')(process.argv.slice(2));
const BitcoinRpc = require('./rpc').Class;
const Q = require('q');

const cmdLineErrors = [];

["cold_wallet_address", "hot_wallet_address", "cold_wallet_percentage", "fee", "user", "password"].forEach(function assertOption(optionName) {
  if (!argv[optionName]) {
    cmdLineErrors.push('Missing --' + optionName + "= command line option");
  }
});

if (cmdLineErrors.length) {
  cmdLineErrors.forEach(function (error) {
    console.log(error);
  });
  process.exit();
}

const bitcoinRpc = new BitcoinRpc({
  host: argv.host || argv.h || 'localhost',
  port: argv.port || argv.p || 8332,
  user: argv.user || argv.u || 'rpc',
  password: argv.password || argv.p || '',
  timeout: parseInt((argv.timeout || argv.t || '30s').replace("s", "000"))
});

bitcoinRpc.listUnspent().then(function (unspents) {
    if (unspents.length !== 0) {
      return Q.all(createRawTransactions(unspents).map(function (transaction) {
          console.log('Found ' + transaction.length + ' unspent transactions');
          console.log('Transaction', transaction);
          return bitcoinRpc.createRawTransaction.apply(bitcoinRpc, transaction).then(function (hexTransaction) {
              console.log('Signing transaction');
              return bitcoinRpc.signRawTransaction(hexTransaction).then(function (signedResponse) {
                  if (signedResponse.complete) {
                      console.log('Sending transaction');
                      console.log(signedResponse.hex);
                      return bitcoinRpc.sendRawTransaction(signedResponse.hex).then(function (transactionId) {
                          console.log('Transaction sent');
                          console.log(transactionId);
                      }).fail(function (response) {
                          console.error(response);
                      });
                  }
              });
          });
      }));
    } else {
        console.log('No unspent addresses');
    }
}).fail(function (response) {
  console.error(response);
});

function createRawTransactions (unspent) {

  let transactions = [];
  let total = 0;

  unspent.forEach(function (t) {
    transactions.push({
      "txid": t.txid,
      "vout": t.vout
    });
    total += t.amount;
  });

  const rawTransaction = [ transactions, {
      address: argv.cold_wallet_address,
      amount: total
  }];

  const rawTransactionStr = JSON.stringify(rawTransaction, null, 2);

  const numberOfTransactions = Math.ceil(rawTransactionStr.length / 245000);
  const numberOfTransactionsPerBlock = Math.ceil(transactions.length / numberOfTransactions);
  const rawTransactions = [];

  const amountToSendToColdWallet = getColdWalletLimit(total, argv.cold_wallet_percentage);
  let amountSentTolColdWallet = 0;
  for (let i = 0; i < numberOfTransactions; i++) {
      transactions = [];
      total = 0;
      for (let j = 0; j < numberOfTransactionsPerBlock; j++) {
        const t = unspent[(i * numberOfTransactionsPerBlock) + j];
        if (t) {
          transactions.push({
            "txid": t.txid,
            "vout": t.vout
          });
          total += t.amount;
        }
      }
      const output = {};
      const address = (amountSentTolColdWallet < amountToSendToColdWallet) ? argv.cold_wallet_address : argv.hot_wallet_address;
      console.log("Sending %s to %s with fee %s", total, address, argv.fee);
      output[address] = parseFloat(parseFloat(total - argv.fee).toPrecision(8));
      rawTransactions.push([ transactions, output ]);
  }

  return rawTransactions;

}

/**
 * This will take the amount discovered in un-spent outputs, and determine how much of it needs
 * to be placed in cold storage.
 */
function getColdWalletLimit (totalAmount, cold_wallet_percentage) {
    return (totalAmount * (cold_wallet_percentage / 100));
}
