var RSVP = require('rsvp');

var schedule = module.exports = {
  wait: function(milliseconds) {
    return new RSVP.Promise(function(resolve, reject) {
      setTimeout(resolve, milliseconds || 1);
    }).then(undefined, function(error) {
      if (error.stack) {
        console.error(error.stack);
      }
      throw error;
    });
  },

  runInParallel: function(promiseFunctions) {
    return new RSVP.Promise(function(resolve, reject) {
      RSVP.all(promiseFunctions.map(function(func) {
        return func().then(undefined, function(error) {
          if (error.stack) {
            console.error(error.stack);
          }
          throw error;
        });
      })).then(resolve, reject);
    });
  },

  runInSerial: function(promiseFunctions, interval) {
    promiseFunctions = (promiseFunctions || []).slice(0);
    return new RSVP.Promise(function(resolve, reject) {
      var results = [];
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
              if (error.stack) {
                console.error(error.stack);
              }
              runNext();
            });
          }
          return results;
        });
      }
      resolve(runNext())
    }).then(undefined, function(error) {
      if (error.stack) {
        console.error(error.stack);
      }
      throw error;
    });
  },

  repeat: function(promiseFunc, interval)  {
    try {
      var promise = promiseFunc();
      interval = interval || 0;
      function runNext() {
        schedule.wait(interval).then(function() {
          schedule.repeat(promiseFunc, interval);
        }, function(error) {
          if (error.stack) {
            console.error(error.stack);
          } else {
            console.log(error);
          }
          schedule.repeat(promiseFunc, interval);
        });
      }
      promise.then(runNext, function(error) {
        if (error.stack) {
          console.error(error, error.stack);
        }
        runNext();
      });
      return promise;
    } catch(e) {
      if (e.stack) {
        console.error(e.stack);
      }
      throw e;
    }
  }
};
