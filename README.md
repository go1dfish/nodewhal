# Nodewhal

Node.js reddit API wrapper that relies heavily on RSVP promises

## Usage

    var Nodewhal = require('nodewhal');

    Nodewhal('my-cool-user-agent').login('kn0thing', 'hunter2').then(function(kn0thing) {
      return kn0thing.listing(session, '/r/POLITIC/new').then(function(posts) {
        return kn0thing.submit('POLITIC', 'link',
          "The Downing Street Memo",
          "http://www.downingstreetmemo.com"
        ).then(function(submission) {
          return kn0thing.flair('POLITIC', submission.name ,
            'flairclass', 'First Post!'
          ).then(function() {return submission;});
        });
      });
    }).then(function(newSubmission) {
      console.log("Posted to", newSubmission.url, "with flair");
    }, function(error) {
      console.error("There was a problem", error);
    });
