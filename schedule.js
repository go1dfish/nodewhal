var RSVP = require('rsvp');

var schedule = module.exports = {
  wait: function(milliseconds) {
    return new RSVP.Promise(function(resolve, reject) {
      setTimeout(resolve, milliseconds || 0);
    });
  },

  runInSerial: function(promiseFunctions, interval) {
    return new RSVP.Promise(function(resolve, reject) {
      var results = [];
      promiseFunctions = promiseFunctions || [];
      interval = interval || 0;
      if (!promiseFunctions.length) {
        resolve([]);
      }

      function runNext() {
        return schedule.wait(interval).then(function() {
          var func = promiseFunctions.pop();
          if (func) {
            return func().then(function(result) {
              results.push(result);
            }).then(runNext, function(error) {
              console.error(error, error.stack);
              runNext();
            });
          }
        });
      }
      return runNext();
    });
  },

  repeat: function(promiseFunc, interval)  {
    var promise = promiseFunc();
    interval = interval || 0;
    function runNext() {
      schedule.wait(interval).then(function() {
        schedule.repeat(promiseFunc, interval);
      });
    }
    promise.then(runNext, function(error) {
      console.error(error, error.stack);
      runNext();
    });
    return promise;
  }
};
