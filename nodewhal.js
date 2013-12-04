var request = require('request'),
    RSVP    = require('rsvp'),
    baseUrl = 'http://www.reddit.com',
    lastRedditRequestTimeByUrl = {},
    lastRedditRequestTime;

function Nodewhal(userAgent) {
  var self = this;
  if (!userAgent) {
    userAgent = 'noob-nodewhal-dev-soon-to-be-ip-banned';
  }

  self.login = function(username, password) {
    var cookieJar = request.jar();
    return self.post(baseUrl + '/api/login', {
      form: {
        api_type: 'json',
        passwd:   password,
        rem:      true,
        user:     username
      }
    }, {cookieJar: cookieJar}).then(function(data) {
      data = data.json.data;
      data.cookieJar = cookieJar;
      return data;
    });
  };

  self.submit = function(session, subreddit, kind, title, urlOrText) {
    urlOrText = urlOrText || '';
    kind = (kind || 'link').toLowerCase();
    var form = {
        api_type: 'json',
        kind:     kind,
        title:    title,
        sr:       subreddit,
        uh:       session.modhash
    };
    if (kind === 'self' || ! urlOrText) {
      form.text = urlOrText;
    } else {
      form.url = urlOrText;
    }
    return self.post(baseUrl + '/api/submit', {form: form}, session).then(function(data) {
      if (data && data.json && data.json.errors && data.json.errors.length) {
        throw data.json.errors;
      }
      if (data && data.json && data.json.data) {return data.json.data;}
      return data;
    });
  };

  self.flair = function(session, subreddit, linkName, template, flairText) {
    console.log('session', session)
    var form = {
        api_type:   'json',
        link:               linkName,
        r:                  subreddit,
        text:               flairText,
        css_class:          template,
        uh:                 session.modhash
    };
    console.log('form', form);
    return self.post(baseUrl + '/api/flair', {
      form: form
    }, session).then(function(result) {
      console.log(JSON.stringify(result));
    });
  };

  self.listing = function(session, listingPath, max, after) {
    var url = baseUrl + listingPath + '.json',
        limit = max || 100;
    if (after) {
      url += '?limit=' + limit + '&after=' + after;
    }
    return self.get(url, {}, session).then(function(listing) {
      var results = {}, resultsLength;
      if (listing && listing.data && listing.data.children && listing.data.children.length) {
        listing.data.children.forEach(function(submission) {
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
          return self.listing(session, listingPath, max, listing.data.after).then(function(moreResults) {
            Object.keys(moreResults).forEach(function(key) {
              results[key] = moreResults[key];
            });
            return results;
          });
        } else {
          return results;
        }
      } else {
        return {};
      }
    });
  };

  self.byName = function(session, names) {
  }

  self.get = function(url, opts, session) {
    return self.req(url, 'get', opts, session);
  };

  self.post = function(url, opts, session) {
    return self.req(url, 'post', opts, session);
  };

  self.req = function(url, method, opts, session) {
    return Nodewhal.respectRateLimits(url).then(function() {
      opts = opts || {};
      if (session && session.cookieJar) {
        opts.jar = session.cookieJar;
      }
      opts.headers = opts.headers || {};
      opts.headers['User-Agent'] = userAgent;
      return Nodewhal.rsvpRequest(method, url, opts);
    }).then(function(body) {
      try {
        return JSON.parse(body);
      } catch(e) {
        console.log('Cant parse', body);
        throw e;
      }
    });
  };
}

Nodewhal.rsvpRequest = function(method, url, opts) {
  return new RSVP.Promise(function(resolve, reject) {
    console.log('requesting', url);
    if (!method || method === 'get') {
      method = request;
    } else {
      method = request[method];
    }
    method(url, opts, function(error, response, body) {
      if (error) {
        reject(error);
      } else {
        resolve(body);
      }
    });
  });
}

Nodewhal.respectRateLimits = function (url) {
  return new RSVP.Promise(function(resolve, reject) {
    var now = new Date(),
        minInterval = 2100,
        minUrlInterval = 30100,
        lastUrlInterval, lastUrlTime = lastRedditRequestTimeByUrl[url],
        interval = now - lastRedditRequestTime;

    if (lastUrlTime) {
      lastUrlInterval = now - lastUrlTime;
    }
    if (lastRedditRequestTime && interval < minInterval) {
      setTimeout(function() {
        resolve(Nodewhal.respectRateLimits(url));
      }, minInterval - interval + 100);
    } else {
      if (lastUrlInterval && lastUrlInterval < minUrlInterval) {
        setTimeout(function() {
          resolve(Nodewhal.respectRateLimits(url));
        }, minUrlInterval - lastUrlInterval + 100);
      } else {
        lastRedditRequestTime = now;
        lastRedditRequestTimeByUrl[url] = now;
        resolve(true);
      }
    }
  });
};

module.exports = Nodewhal;
