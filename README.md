# Nodewhal

Node.js reddit API wrapper that relies heavily on RSVP promises

## Usage

    var Nodewhal = require('nodewhal'),
        reddit = new Nodewhal('my-cool-user-agent');

    reddit.login('yishan', 'hunter2').then(function(session) {
      return reddit.listing(session, '/r/POLITIC/new').then(function(posts) {
        return reddit.submit(session, 'POLITIC', 'link',
          "The Downing Street Memo",
          "http://www.downingstreetmemo.com"
        ).then(function(submission) {
          return reddit.flair(session, 'POLITIC', submission.name ,
            'flairclass', 'First Post!'
          ).then(function() {return submission;});
        });
      });
    }).then(function(newSubmission) {
      console.log("Posted to", newSubmission.url, "with flair");
    }, function(error) {
      console.error("There was a problem", error);
    });
