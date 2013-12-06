var request = require('request'),
  RSVP = require('rsvp'),
  schedule = require('./schedule'),
  EventSource = require('eventsource'),
  baseUrl = 'http://www.reddit.com',
  knownShadowbans = {},
  lastRedditRequestTimeByUrl = {},
  lastRedditRequestTime;

function Nodewhal(userAgent) {
  var self = this;

  if (!userAgent) {
    userAgent = 'noob-nodewhal-dev-soon-to-be-ip-banned';
  }
  self.newSubmissions = [];
  self.login = function (username, password) {
    var cookieJar = request.jar();
    return self.post(baseUrl + '/api/login', {
      form: {
        api_type: 'json',
        passwd: password,
        rem: true,
        user: username
      }
    }, {cookieJar: cookieJar}).then(function (data) {
        self.session = data.json.data;
        self.session.cookieJar = cookieJar;
        return self;
      });
  };

  self.submit = function (subreddit, kind, title, urlOrText) {
    urlOrText = urlOrText || '';
    kind = (kind || 'link').toLowerCase();
    var form = {
      api_type: 'json',
      kind: kind,
      title: title,
      sr: subreddit,
      uh: self.session.modhash
    };
    console.log('Submitting', urlOrText);
    if (kind === 'self' || !urlOrText) {
      form.text = urlOrText;
    } else {
      form.url = urlOrText;
    }
    return self.post(baseUrl + '/api/submit', {form: form}).then(function (data) {
      if (data && data.json && data.json.errors && data.json.errors.length) {
        throw data.json.errors;
      }
      if (data && data.json && data.json.data) {
        return data.json.data;
      }
      return data;
    });
  };

  self.comment = function (thing_id, markdown) {
    return self.post(baseUrl + '/api/comment', {
      form: {
        api_type: 'json',
        text: markdown,
        thing_id: thing_id,
        uh: self.session.modhash
      }
    });
  };

  self.flair = function (subreddit, linkName, template, flairText) {
    return self.post(baseUrl + '/api/flair', {
      form: {
        api_type: 'json',
        link: linkName,
        r: subreddit,
        text: flairText,
        css_class: template,
        uh: self.session.modhash
      }
    })
  };

  self.aboutUser = function (username) {
    return self.get(baseUrl + '/user/' + username + '/about.json', {});
  };

  self.submitted = function (subreddit, url) {
    url = encodeURIComponent(url);
    return self.get(baseUrl + '/r/' + subreddit + '/submit.json?url=' + url, {});
  };

  self.checkForShadowban = function (username) {
    var url = baseUrl + '/user/' + username;
    return Nodewhal.respectRateLimits('get', url).then(function () {
      return new RSVP.Promise(function (resolve, reject) {
        if (knownShadowbans[username]) {
          return resolve('shadowban');
        }
        request(url, {}, function (error, response, body) {
          if (error) {
            reject(error);
          } else {
            if (body.indexOf('the page you requested does not exist') === -1) {
              resolve(username);
            } else {
              knownShadowbans[username] = true;
              reject('shadowban');
            }
          }
        });
      });
    });
  };

  self.listing = function (listingPath, options) {
    var url = baseUrl + listingPath + '.json',
      options = options || {},
      max = options.max,
      after = options.after,
      limit = max || 100;
    if (after) {
      url += '?limit=' + limit + '&after=' + after;
    }
    return self.get(url, {}).then(function (listing) {
      var results = {}, resultsLength;
      if (listing && listing.data && listing.data.children && listing.data.children.length) {
        listing.data.children.forEach(function (submission) {
          results[submission.data.name] = submission.data;
        });
        resultsLength = Object.keys(results).length;

        if (
          listing.data.after &&
            (typeof max === 'undefined' || resultsLength < max)
          ) {
          if (!typeof max === 'undefined') {
            max = max - resultsLength;
          }
          return schedule.wait(options.wait).then(function () {
            return self.listing(listingPath, {
              max: max,
              after: listing.data.after,
              wait: options.wait
            }).then(function (moreResults) {
                Object.keys(moreResults).forEach(function (key) {
                  results[key] = moreResults[key];
                });
                return results;
              })
          });
        } else {
          return results;
        }
      } else {
        return {};
      }
    });
  };

  self.startSubmissionStream = function (cb, subreddit, author, domain, is_self) {
    url = "http://api.rednit.com/submission_stream?eventsource=true";
    if (subreddit) {
      url += "&subreddit=" + subreddit;
    }
    if (author) {
      url += "&author=" + author;
    }
    if (domain) {
      url += "&domain=" + domain;
    }
    if (is_self) {
      url += "&is_self=" + is_self;
    }
    self.es = new EventSource(url);
    if (cb != null) {
      self.es.onmessage = function (e) {
        cb(e.data);
      }
    }
    else {

      self.es.onmessage = function (e) {
        self.newSubmissions.push(e.data);
      };
      self.es.onerror = function () {
        console.log("Error in the submission stream.");
      }
    }
  };

  self.stopSubmissionStream = function () {
    self.es.close();
  };

  self.byId = function (ids) {
    if (typeof ids == "string") {
      ids = [ids]
    }
    ids = ids.map(function (id) {
      if (id.substr(0, 3) == "t3_") {
        return id
      }
      else {
        return "t3_" + id;
      }
    });

    var fetch_ids_wrapper = function (u) {
      var url = u;
      return function () {
        return self.get(url, {}).then(function (listing) {
          var results = {};
          if (listing && listing.data && listing.data.children && listing.data.children.length) {
            listing.data.children.forEach(function (submission) {
              results[submission.data.name] = submission.data;
            });
          }
          return results;
        })
      }
    };
    console.log("Fetching submissions.");
    if (ids.length <= 5) {
      var url = baseUrl + "/by_id/" + ids.join(",") + '/.json';
      return fetch_ids_wrapper(url)();
    }
    else {
      var promises = [];

      for (var i = 0; i < Math.ceil((ids.length + 1) / 100); i++) {
        u = baseUrl + "/by_id/" + ids.slice(0 + (i * 100), 100 + (i * 100)).join(",") + '/.json';
        promises.push(fetch_ids_wrapper(u))
      }
      return schedule.runInSeries(promises).then(function (resultList) {
        var results = {};
        resultList.forEach(function (element, index, array) {
          for (attrname in element) {
            results[attrname] = element[attrname];
          }
        });
        return results;
      });

    }

  };

  self.get = function (url, opts) {
    return self.req(url, 'get', opts);
  };

  self.post = function (url, opts) {
    return self.req(url, 'post', opts);
  };

  self.req = function (url, method, opts) {
    return Nodewhal.respectRateLimits(method, url).then(function () {
      opts = opts || {};
      if (self.session && self.session.cookieJar) {
        opts.jar = self.session.cookieJar;
      }
      opts.headers = opts.headers || {};
      opts.headers['User-Agent'] = userAgent;
      return Nodewhal.rsvpRequest(method, url, opts);
    }).then(function (body) {
        var json;
        try {
          json = JSON.parse(body);
        } catch (e) {
          console.error('Cant parse', body);
          throw e;
        }
        if (json && json.error) {
          console.log('error', json);
          throw json.error;
        }
        return json;
      }, function (error) {
        if (error.stack) {
          console.error(error.stack);
        }
        throw error;
      });
  };
}


Nodewhal.schedule = schedule;

Nodewhal.rsvpRequest = function (method, url, opts) {
  return new RSVP.Promise(function (resolve, reject) {
    console.log('requesting', url);
    if (!method || method === 'get') {
      method = request;
    } else {
      method = request[method];
    }
    method(url, opts, function (error, response, body) {
      if (error) {
        reject(error);
      } else {
        resolve(body);
      }
    });
  });
};

Nodewhal.respectRateLimits = function (method, url) {
  return new RSVP.Promise(function (resolve, reject) {
    var now = new Date(),
      minInterval = 2100,
      minUrlInterval = 30100,
      lastUrlInterval, lastUrlTime = lastRedditRequestTimeByUrl[url],
      interval = now - lastRedditRequestTime;

    if (method == 'get' && lastUrlTime) {
      lastUrlInterval = now - lastUrlTime;
    }
    if (lastRedditRequestTime && interval < minInterval) {
      resolve(schedule.wait(minInterval - interval).then(function () {
        return Nodewhal.respectRateLimits(method, url);
      }));
    } else {
      if (lastUrlInterval && lastUrlInterval < minUrlInterval) {
        resolve(schedule.wait(minUrlInterval - lastUrlInterval).then(function () {
          return Nodewhal.respectRateLimits(method, url);
        }));
      } else {
        lastRedditRequestTime = now;
        lastRedditRequestTimeByUrl[url] = now;
        resolve(true);
      }
    }
  }).then(undefined, function (error) {
      if (error.stack) {
        console.error(error.stack);
      }
      throw error;
    });
};

module.exports = Nodewhal;

x = new Nodewhal("Nodewhal dev client");