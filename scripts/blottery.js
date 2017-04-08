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
  let ticketWon = [];
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
    return gc.persons().get({ personId: personId });
  }

  function getGroup(groupId){
    return gc.groups().get({ groupId: groupId });
  }

  function isMessageFromMyself(res) {
    return getUserFromRes(res).id === currentUser.id;
  }

  function getUserFromRes(res) {
    return res.message.user;
  }

  function checkPrivateRoom (res) {
    return getGroup(res.message.room)
      .then(function(group) {
        return group.members.length <= 2
      })
      .then(function(isPrivateRoom) {
        if(!isPrivateRoom) res.reply('You should not playing game in a public group. Please chat with me in privately.');
        return isPrivateRoom;
      })
  }

  function showHint({bulls, cows}) {
    return `${bulls}A${cows}B`;
  }

  function showHistory(res) {
    let game = db.games[getUserFromRes(res).id];
    if (game) {
      let { history } = game.show();
      if (history && history.length > 0) {
        let msg = history.map((item, idx) => `|#${idx+1}|**${item.ans}**|**${showHint(item)}**|${item.isCorrect ? '✅' : '❎'}|`);
        return '|Attempt|Guess|Hint|Status|\n' + msg.join('\n');
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

      checkPrivateRoom(res).then(function(isPrivateRoom) {
        if (isPrivateRoom) {
          let { id: userId } = getUserFromRes(res);
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
        }
      });
    });

    // guess
    robot.hear(new RegExp(`^[0-9]{${GAME_DIGITS}}$`), function(res) {
      checkPrivateRoom(res).then(function(isPrivateRoom) {
        if (isPrivateRoom) {
          let { id: userId } = getUserFromRes(res);
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
        }
      });
    });

    // give up
    robot.hear(/.*give.+up.*/i, function(res){
      if (isMessageFromMyself(res)) return;

      checkPrivateRoom(res).then(function(isPrivateRoom) {
        if (isPrivateRoom) {
          if (db.games[getUserFromRes(res).id]) {
            db.games[getUserFromRes(res).id] = null;
            res.reply('You already give up for last game. If you want to **play another game** please tell me?');
          } else {
            res.reply('Oops, it seems you don\'t play game now. You can **play a game**' );
          }
        }
      });

    });

    // game history
    robot.hear(/.*history.*/i, function(res){
      if (isMessageFromMyself(res)) return;
      checkPrivateRoom(res).then(function(isPrivateRoom) {
        if (isPrivateRoom) {
          res.reply(showHistory(res));
        }
      });
    });

    // bride
    robot.hear(/.*bride.*?\s([0-9]+).*/i, function(res){
      if (isMessageFromMyself(res)) return;

      checkPrivateRoom(res).then(function(isPrivateRoom) {
        if (isPrivateRoom) {
          let { id: userId } = getUserFromRes(res);
          let game = db.games[userId];

          if(game && !game.isCompleted()) {
            let amount = parseInt(res.match[1], 10);
            if(checkCoin(res, amount)) {
              let user = db.users[getUserFromRes(res).id];
              user.coin -= amount;
              let rate = amount / GAME_COIN_GOOD;
              let digitsUnlocked = Math.floor(GAME_DIGITS * rate);
              res.reply(`The hint is ${shadow(game, digitsUnlocked)}, your balance is ${user.coin}`)
            }
          } else {
            res.reply('You are not playing game!')
          }
        }
      });
    });

    // buy lottery
    robot.hear(/.*buy.+lottery.*/i, function(res){
      if (isMessageFromMyself(res)) return;
      checkPrivateRoom(res).then(function(isPrivateRoom) {
        if (isPrivateRoom) {
          let amount = GAME_LOTTERY_PRICE;
          if(checkCoin(res, GAME_LOTTERY_PRICE)) {
            let user = db.users[getUserFromRes(res).id];
            user.coin -= amount;
            let sn = ++ticketSerial;
            user.tickets.push(sn);
            res.reply(`You brought lottery #${sn}. You have ${user.tickets.length} lottery(ies), balance ${user.coin}`);
          }
        }
      });
    });

    // my lottery
    robot.hear(/.*my.+lottery.*/i, function(res){
      if (isMessageFromMyself(res)) return;

      checkPrivateRoom(res).then(function(isPrivateRoom) {
        if (isPrivateRoom) {
          let user = db.users[getUserFromRes(res).id];
          if (!user) {
            res.reply(`You never play any game`);
          } if (user.tickets.length === 0) {
            res.reply(`You have no lottery.`);
          } else {
            let msg = 'You have lottery(ies): ' + user.tickets.map(id => '#' + id ).join(', ');
            res.reply(msg);
          }
        }
      });
    });

    robot.hear(/.*my.+coin.*/i, function(res){
      if (isMessageFromMyself(res)) return;

      checkPrivateRoom(res).then(function(isPrivateRoom) {
        if (isPrivateRoom) {
          let user = db.users[getUserFromRes(res).id];
          if (user) {
            res.reply(`You have ${user.coin} coins.`);
          } else {
            res.reply(`You never play any game`);
          }
        }
      });
    });

    robot.hear(/cheese steak jimmy's/i, function(res){
      if (isMessageFromMyself(res)) return;

      checkPrivateRoom(res).then(function(isPrivateRoom) {
        if (isPrivateRoom) {
          let { id: userId } = getUserFromRes(res);
          if (!db.users[userId]) db.users[userId] = initUser();

          db.users[userId].coin += 1000;
          res.reply(`You must be a big fan of Age Of Empire 2. ❤️`);
        }
      });

    });

    robot.hear(/i'm the boss/i, function(res){
      if (isMessageFromMyself(res)) return;

      checkPrivateRoom(res).then(function(isPrivateRoom) {
        if (isPrivateRoom) {
          let { id: userId } = getUserFromRes(res);
          if (!db.users[userId]) db.users[userId] = initUser();
          db.users[userId].super = true;

          res.reply(`You have been grant super user privilege!`);
        }
      });
    });

    robot.hear(/(.+) lucky draw/i, function(res){
      if (isMessageFromMyself(res)) return;

      let { id: userId } = getUserFromRes(res);
      let user = db.users[userId];
      if (user && user.super) {
          res.reply(`Lucky draw from ${ticketSerial - ticketWon.length} lotteries`)

          setTimeout(draw.bind(null, res, res.match[1]), Math.random() * 2000);
      } else {
        res.reply(`You don't have super user privilege!`);
      }
    });

    robot.hear(/show rank/i, function(res){
      if (isMessageFromMyself(res)) return;

      let msg = `We have ${ticketSerial - ticketWon.length} lotteries in the ballot`;

      // richest
      let richest = Object.keys(db.users).sort((a, b) => db.users[a].coin - db.users[b].coin).reverse().slice(0, 10);

      // the most tickets
      let ticketOwner = Object.keys(db.users).sort((a, b) => db.users[a].tickets.length - db.users[b].tickets.length).reverse().slice(0, 10);

      let userIds = (function(arr){
        let tmp = {};
        arr.forEach(item => tmp[item] = '');
        return Object.keys(tmp);
      })(richest.concat(ticketOwner));

      if (userIds.length !== 0) {
        Promise.all( userIds.map( userId => getUser(userId)) ).then(users => {
          if (richest.length !== 0) {
            msg += '\n\n**Richest:**\n';
            msg += richest.map( (userId, idx) => {
              let user = users[userIds.indexOf(userId)];
              return `**#${idx + 1}** ${user.firstName} ${user.lastName}: ${db.users[userId].coin} coin`
            }).join('\n');
          }

          if (ticketOwner.length !== 0) {
            msg += '\n\n**Lottery Owner:**\n';
            msg += ticketOwner.map( (userId, idx) => {
              let user = users[userIds.indexOf(userId)];
              return `**#${idx + 1}** ${user.firstName} ${user.lastName}: ${db.users[userId].tickets.length} lotteries`
            }).join('\n');
          }

          res.reply(msg);
        });
      } else {
        res.reply(msg);
      }
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

  function checkCoin(res, amount) {
    let user = db.users[getUserFromRes(res).id];
    if(amount > user.coin) {
      res.reply(`You don't have enough coin. You need ${amount}. But you only have ${user.coin}.`)
      return false;
    }

    return true;
  }
  let shadowList = ['❍', '⚀', '🀚' , 'ⅲ', '🍀', 'Ⅴ', 'ⅵ', 'ⅶ', '𐄗', 'ⅸ'];
  function shadow(game, digitsUnlocked) {
    let correctAns = game.cheat();
    let res = '';
    for(let i = 0; i < correctAns.length; i++) {
      if (i < digitsUnlocked) {
        res += shadowList[correctAns[i]];
      } else {
        res += '❓';
      }
    }
    return res;
  }

  function draw(res, itemName) {
    if( ticketSerial - ticketWon.length === 0 ){
      res.reply(`No winner. Due to no lottery in the ballot`)
    } else {
      let rnd = Math.round(Math.random() * ticketSerial);
      if (rnd === 0 || ticketWon.indexOf(rnd) !== -1) {
        draw(res, itemName);
      } else {
        ticketWon.push(rnd);
        let userId = Object.keys(db.users).find(userId => {
          let user = db.users[userId];
          let idx = user.tickets.indexOf(rnd);
          if(idx !== -1) {
            user.tickets.splice(idx, 1);
            return true;
          }
        });
        getUser(userId).then(function(user){
          res.reply(`The lottery #${rnd} owned by **@${user.firstName} ${user.lastName}** won **${itemName}**`);
        });
      }
    }
  }
}
