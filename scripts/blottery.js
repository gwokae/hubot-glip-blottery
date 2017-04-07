const Game = require('bulls-and-cows');
const gameDigits = (function(digit){
  return (digit > 0 && digit <= 10) ? digit : 4;
})(parseInt(process.env.GAME_DIGITS, 10));
const GlipClient = require('glip-client')
const gc = new GlipClient({
  server: process.env.HUBOT_GLIP_SERVER, // https://platform.ringcentral.com for production or https://platform.devtest.ringcentral.com for sandbox
  appKey: process.env.HUBOT_GLIP_APP_KEY,
  appSecret: process.env.HUBOT_GLIP_APP_SECRET,
  appName: 'Whatever',
  appVersion: '0.0.0'
});

module.exports = function(robot) {
  let currentUser;
  let db = { games: {}, users: {} };
  gc.authorize({
      username: process.env.HUBOT_GLIP_USERNAME,
      extension: process.env.HUBOT_GLIP_EXTENSION,
      password: process.env.HUBOT_GLIP_PASSWORD
    })
    .then(function(){
      getUser('~').then(function(user){
        currentUser = user;
        initRobot();
      });
    });

  function getUser(personId){
    return gc.persons().get({ personId: personId }).then(function(user){
      return user;
    })
  }

  function isMessageFromMyself(res) {
    return getUserFromRes(res).id === currentUser.id;
  }

  function getUserFromRes(res) {
    return res.message.user;
  }

  function checkPrivateRoom (res) {
    // TODO: implement
    let isPrivateRoom = false;
    if (isPrivateRoom) {
      res.reply('You should not playing game in a public group!!')
    }
    return !isPrivateRoom;
  }

  function showHint({bulls, cows}) {
    return `${bulls}A${cows}B`;
  }

  function showHistory(res) {
    let game = db.games[getUserFromRes(res)];
    if (game) {
      let { history } = game.show();
      if (history && history.length > 0) {
        let msg = history.map((item, idx) => `Apptmpt #${idx+1}: **${item.ans}** ⇒ **${showHint(item)}** ${item.isCorrect ? '✅' : '❎'}`);
        return msg.join('\n');
      } else {
        return `You don't have any attempt, please send ${gameDigits} digits number to guess`;
      }
    } else {
      return 'Oops, it seems you don\'t play game now. You can **play a game**' ;
    }
  }


  function initRobot(){
    robot.hear(/.*play.+game.*/i, function(res){
      if (isMessageFromMyself(res)) {
        return;
      }

      if (!checkPrivateRoom(res)) {
        return;
      }

      let game = db.games[getUserFromRes(res)];
      if (game && !game.isCompleted()) {
        res.reply('You already create a game. Do you wanna **give up** ?');
      } else {
        let theAns = Game.generate(gameDigits);
        console.log('You might need this ⇒⇒⇒⇒⇒⇒⇒', theAns);
        db.games[getUserFromRes(res)] = Game.newGame(theAns);
        res.reply(`Your game had been started. Please send ${gameDigits} digits number to guess`);
      }
    });

    robot.hear(new RegExp(`^[0-9]{${gameDigits}}$`), function(res) {
      if (!checkPrivateRoom(res)) {
        return;
      }

      let game = db.games[getUserFromRes(res)];
      if(game) {
        if (game.isCompleted()) {
          res.reply('You already win your last game. Do you want to **play another game** or check the **history**?');
        } else {
          let result = game.guess(res.match[0]);
          let {hint} = result;
          if (result.completed) {
            // todo: show more info
            res.reply(`Your answer, ${hint.ans}, is correct! **${showHint(hint)}**\n\n${showHistory(res)}`);
          } else {
            res.reply(`Your attempt, ${hint.ans}, is **${showHint(hint)}**`)
          }
        }
        return;
      }
      res.reply('Do you want to **play a game** ?');
    });

    robot.hear(/.*give.+up.*/i, function(res){
      if (isMessageFromMyself(res)) return;

      if (db.games[getUserFromRes(res)]) {
        db.games[getUserFromRes(res)] = null;
        res.reply('You already give up for last game. If you want to **play another game** please tell me?');
      } else {
        res.reply('Oops, it seems you don\'t play game now. You can **play a game**' );
      }
    });

    robot.hear(/.*history.*/i, function(res){
      if (isMessageFromMyself(res)) return;

      res.reply(showHistory(res));
    });

  }
}
