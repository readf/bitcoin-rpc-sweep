

const Bitcoin = require('bitcoin');
const Q = require('q');
const ES5Class = require('es5class');

exports.Class = ES5Class.$define('BitcoinRpc', function () {
  var p = {
    client: null,
    resolveFirstArgument: function (args) {
      return Q(args[0]);
    }
  };

  return {

    construct: function (options) {
      p.client = new Bitcoin.Client({
        host: options.host,
        port: options.port,
        user: options.user,
        pass: options.password,
        timeout: options.timeout
      });

      p.createRawTransaction = Q.denodeify(p.client.createRawTransaction.bind(p.client));
      p.signRawTransaction = Q.denodeify(p.client.signRawTransaction.bind(p.client));
      p.sendRawTransaction = Q.denodeify(p.client.sendRawTransaction.bind(p.client));
      p.listUnspent = Q.denodeify(p.client.listUnspent.bind(p.client));
    },

    createRawTransaction: function () {
      return p.createRawTransaction.apply(p.createRawTransaction, arguments).then(p.resolveFirstArgument);
    },

    signRawTransaction: function () {
      return p.signRawTransaction.apply(p.signRawTransaction, arguments).then(p.resolveFirstArgument);
    },

    sendRawTransaction: function () {
      return p.sendRawTransaction.apply(p.sendRawTransaction, arguments).then(p.resolveFirstArgument);
    },

    listUnspent: function () {
      return p.listUnspent.apply(p.listUnspent, arguments).then(p.resolveFirstArgument);
    }
  };
});
