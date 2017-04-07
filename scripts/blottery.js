const Game = require('bulls-and-cows');
const GAME_DIGITS = (function(digit){
  return (digit > 0 && digit <= 10) ? digit : 4;
})(parseInt(process.env.GAME_DIGITS, 10));
const GAME_COIN_GOOD = 100;
const GAME_COIN_BAD = 10;
const GAME_GOOD_ATTEMPTS = 8;
const GAME_BAD_ATTEMPTS = 20;
const GAME_LOTTERY_PRICE = 100;
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
  let ticketSerial = 0;
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
        let msg = history.map((item, idx) => `Attempt #${idx+1}: **${item.ans}** ⇒ **${showHint(item)}** ${item.isCorrect ? '✅' : '❎'}`);
        return msg.join('\n');
      } else {
        return `You don't have any attempt, please send ${gameDigits} digits of number to guess`;
      }
    } else {
      return 'Oops, it seems you don\'t play game now. You can **play a game**' ;
    }
  }


  function initRobot(){
    // new game
    robot.hear(/.*play.+game.*/i, function(res){
      if (isMessageFromMyself(res)) {
        return;
      }

      if (!checkPrivateRoom(res)) {
        return;
      }

      let userId = getUserFromRes(res)
      let game = db.games[userId];
      if (game && !game.isCompleted()) {
        res.reply('You already create a game. Do you wanna **give up** ?');
      } else {
        let theAns = Game.generate(GAME_DIGITS);
        console.log('You might need this ⇒⇒⇒⇒⇒⇒⇒', theAns);
        db.games[userId] = Game.newGame(theAns);
        if(!db.users[userId]) db.users[userId] = initUser();
        db.users[userId].counts.game++;
        res.reply(`Your game had been started. Please send ${GAME_DIGITS} digits number to guess`);
      }
    });

    // guess
    robot.hear(new RegExp(`^[0-9]{${GAME_DIGITS}}$`), function(res) {
      if (!checkPrivateRoom(res)) {
        return;
      }

      let userId = getUserFromRes(res);
      let game = db.games[userId];
      if(game) {
        if (game.isCompleted()) {
          res.reply('You already win your last game. Do you want to **play another game** or check the **history**?');
        } else {
          let result = game.guess(res.match[0]);
          let {hint} = result;
          let user = db.users[userId];
          let { counts } = user;

          counts.attempt++;
          if (result.completed) {
            counts.win++;

            let attempt = game.show().history.length;
            let coinEarned = calcCoin(attempt);
            user.coin += coinEarned;
            res.reply(`Your answer, ${hint.ans}, is correct. **You win** the game! \n\n**Result:** \nAttempt(s): ${attempt} \nEarned: ${coinEarned} coin \nBalance: ${user.coin} coin. \n\nDo you want to **play another game** or check the **history**?`);
          } else {
            res.reply(`Your attempt, ${hint.ans}, is **${showHint(hint)}**`)
          }
        }
        return;
      }
      res.reply('Do you want to **play a game** ?');
    });

    // give up
    robot.hear(/.*give.+up.*/i, function(res){
      if (isMessageFromMyself(res)) return;

      if (db.games[getUserFromRes(res)]) {
        db.games[getUserFromRes(res)] = null;
        res.reply('You already give up for last game. If you want to **play another game** please tell me?');
      } else {
        res.reply('Oops, it seems you don\'t play game now. You can **play a game**' );
      }
    });

    // game history
    robot.hear(/.*history.*/i, function(res){
      if (isMessageFromMyself(res)) return;

      res.reply(showHistory(res));
    });

  }

  function initUser() {
    return { counts: {game: 0, win: 0, attempt: 0}, coin: 0, tickets: [] };
  }

  const GOOD_BAD_ATTEMPT_DIFF = GAME_BAD_ATTEMPTS - GAME_GOOD_ATTEMPTS;
  const GOOD_BAD_COIN_DIFF = GAME_COIN_GOOD - GAME_COIN_BAD;
  function calcCoin(attempt) {
    if (attempt <= GAME_GOOD_ATTEMPTS) {
      return GAME_COIN_GOOD;
    } else if ( attempt >= GAME_BAD_ATTEMPTS) {
      return GAME_COIN_BAD;
    }

    let rate = (attempt - GAME_GOOD_ATTEMPTS) / GOOD_BAD_ATTEMPT_DIFF;
    return Math.round(GOOD_BAD_COIN_DIFF * rate);
  }
}
