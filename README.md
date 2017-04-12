# Blottery

A BOTAITHON 2017 project @ RC XMN by [Leonard Lin ❤️](mailto:leonard.lin@ringcentral.com).

Blottery is a lottery bot who help organization to having some competitions and give some gifts away internally. 

## Competition

Users should earn **coin** form playing games. And use the coin to purchase **lottery ballot**.  The more ballots a user have, the better chance to win the prize.

## The Game 

Blottery are playing a game called [Bulls and Cows](https://en.wikipedia.org/wiki/Bulls_and_Cows). The bot will randomly genterate 4 digits of non-repeated number. 

The goal of this game is guess the exactly same number of the answer. Each attempt the bot will given a hint from the guess. So players can follow the hint to solve real answer.

Based on the count of attempts, the bot will reward **maximun 100** coin to the winner.

### Hint

The hint will represent in **?A?B** format (? is a number). **A** means the count of both the number and position is correct and **B** means the count of number exists but in different position.

For instance, assume the answer is 9487 and user guess 9876. The hint will be **1A2B**. Because 9 exists in the answer and also met correct position and 8, 7 exist in the answer but in a wrong position. So the goal is get **4A0B**.

### History

The player can query the game history.

### Bribe 

The player can bride some coin to get more information.

### Give up

To restart a new game, players must give if they are playing game.

## Ranking

The bot will show the real time ranking to players. So players can understand their position in the competition.

## Lottery

Player can use 100 coin to buy a lottery ballot. A ballot mean a chance to win the lottery prize.

### Super user

A super user can conduct a lottery for some prize. And the bot will help to randomly choose a winner from the box; 

## Magic

The Age of Empire 2 fan will eventually win for some reason. 🤣

## Start-up Sample

```
HUBOT_LOG_LEVEL='debug' \
HUBOT_GLIP_APP_KEY='YOUR KEY' \
HUBOT_GLIP_APP_SECRET='YOUR SECRET' \
HUBOT_GLIP_USERNAME='RC USERNAME' \
HUBOT_GLIP_EXTENSION='RC EXT.' \
HUBOT_GLIP_PASSWORD='RC PASSWORD' \
HUBOT_GLIP_SERVER='https://platform.devtest.ringcentral.com' \
./bin/hubot-debug -a glip
```
