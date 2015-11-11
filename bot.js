var SlackBot = require('slackbots');
var fs = require('fs');
var redis = require('redis');
var config = require('./config');

var client = redis.createClient();

client.on("error", function (err) {
  console.log("Redis error " + err);
});

var bot = new SlackBot({
  token: config.slack_api_token, 
  name: 'reactji'
});

bot.isMessageToBot = function(text) {
  return text.indexOf("<@" + bot.self.id + ">") === 0;
}

bot.on('start', function() {
});

bot.on('message', function(data) {
  console.log(data);
  
  log_message(data);
    
  if (data['type'] === 'reaction_added') {
    bot.emit('reaction_added', data);
  }

  if (data['type'] === 'message') {
    if (bot.isMessageToBot(data['text'])) {
      bot.emit('message_to_me', data);
    }
  }

});

bot.on('reaction_added', function(data) {
//    {"type":"reaction_added","user":"U03H28RTU","item":{"type":"message","channel":"C0E1ZBW3C","ts":"1446948436.000018"},"reaction":"face_with_rolling_eyes","event_ts":"1446948790.877152"}
    
  message_by_ts(data['item']['channel'], data['item']['ts']).then(function(rsp) {

    if (rsp['ok']) {
      mesg = rsp['messages'][0];
    
      if (mesg) {
        user_id = mesg['user'] || mesg['username'];
        record_reaction(user_id, data, 1);
      }
    }
  });
});

bot.on('message_to_me', function(data) {
    // {"type":"message","channel":"C0E1ZBW3C","user":"U03H28RTU","text":"<@U0E1ZBYTC>: quxx","ts":"1446926834.000010","team":"T03H28RTN"}
    
    // did you ask about someone else's score?
    var matches = data['text'].match(/<@[^>]+>.*?<@([^>]+)>/);

    if (matches && matches[1]) {
      user_id = matches[1];
    } else {
      user_id = data['user'];
    }

    client.zrevrange([reaction_key(user_id), 0, 10, 'WITHSCORES'], function (err, obj) {

      if (obj.length > 0) {
        msg = "<@" + user_id + ">";
        for (var i = 0; i < obj.length; i=i+2) {
          msg += " :" + obj[i] + ": ";
          msg += obj[i+1];
        }     

        bot.postMessage(data['channel'], msg);
      } else {
          bot.postMessage(data['channel'], "I know nothing");
      }
  });

});

function message_by_ts(channel, ts) {

    return bot._api('channels.history', {
      channel: channel,
      latest: ts,
      oldest: ts,
      inclusive: 1,
      limit: 1
    });
}

function record_reaction(username, mesg, score) {
  client.zincrby(reaction_key(username), score, mesg['reaction']);
}

function reaction_key(username) {
  return rk(['reactji', bot.team.id, username]);
}

function rk() {
  return Array.prototype.slice.call(arguments).join(':')
}

function log_message(data) {
  if (config.log_messages) {
    fs.appendFile('message.txt', new Date().toISOString() + " " + JSON.stringify(data) + "\n", function (err) {
      if (err) throw err;
    });  
  }
}
