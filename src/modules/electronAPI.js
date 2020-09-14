const http = require('http');
const fs = require('fs-extra');
const axios = require('axios');
const path = require('path');

const ddragon = axios.create({
  baseURL: 'https://ddragon.leagueoflegends.com/cdn/',
  method: 'GET',
  responseType: 'stream',
});

const server = http.createServer(async (req, res) => {
  const auth = req.headers['authorization'] || '';
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { method } = req;

  // TODO: enable security.
  // if (method !== 'OPTIONS' && auth.slice(7) !== publicAPI.auth) {
  //   res.statusCode = 401;
  //   return res.end('INVALID AUTH');
  // }

  const pathname = req.url;
  const pathnameSplit = pathname.split('/');
  const pathBeginning = pathnameSplit[1];
  switch (pathBeginning) {
    case 'liveGame':
      try {
        if (!publicAPI.liveGame.participants) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'text/plain');
          res.end('User is not in live game.');
          break;
        }
        if (!publicAPI.currentAccount.data) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'text/plain');
          res.end('User has no associated account in Blitz client.');
          break;
        }
        const championData = publicAPI.championKeys;
        const mapId = publicAPI.liveGame.mapId;
        const currentAccountName = publicAPI.currentAccount.data.account.name;
        const currentPatch = publicAPI.currentPatch;
        const currentLanguage = publicAPI.currentLanguage;

        // sort the participants into red and blue teams
        const blueTeam = [];
        const redTeam = [];
        let isBlueTeamAlly = true;
        publicAPI.liveGame.participants.forEach(participant => {
          const { perks, teamId, summonerName } = participant;
          const championName = championData[participant.championId];
          // allows us to set the team of the current account to 'allied' and the opposing team to 'enemy'
          if (summonerName === currentAccountName && teamId !== 100)
            isBlueTeamAlly = false;
          if (teamId === 100) {
            blueTeam.push({
              name: summonerName,
              championName: championName,
              runes: perks,
            });
          } else {
            redTeam.push({
              name: summonerName,
              championName: championName,
              runes: perks,
            });
          }
        });

        // read the directory for all language names
        const files = await fs.readdir(
          path.join(publicAPI.resourceDirectory, `${currentPatch}.1`, 'data')
        );
        if (!files) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'text/plain');
          res.end('Data has not been loaded yet.');
          break;
        }
        const language = await files.filter(
          file =>
            file === currentLanguage || file.slice(0, 2) === currentLanguage
        ); // en_US === en || en === en
        const filePath = path.join(
          publicAPI.resourceDirectory,
          `${currentPatch}.1`,
          'data',
          language[0],
          'summoner.json'
        );
        const fileExists = await fs.pathExists(filePath);
        if (!fileExists) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'text/plain');
          res.end('Summoner spell data does not exist.');
          break;
        }
        const summonerSpellData = await fs.readJSON(filePath);

        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            mapId,
            allies: isBlueTeamAlly ? blueTeam : redTeam,
            enemies: !isBlueTeamAlly ? blueTeam : redTeam,
            summoners: summonerSpellData,
          })
        );
        break;
      } catch (err) {
        console.log(err);
      }
    case 'build':
      if (!publicAPI.currentBuild.data) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain');
        res.end('User is not in a game or does not have a build.');
        break;
      }
      const currentBuild = publicAPI.currentBuild.data;
      const currentLevel = pathnameSplit[2];
      const skillOrder = currentBuild.stats.skills.build;
      const nextSkill = skillOrder[currentLevel - 1];
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ skill: nextSkill }));
      break;
    case 'static':
      const ddragonPath = pathnameSplit.slice(2).join('/');
      const filePath = path.join(publicAPI.resourceDirectory, ddragonPath);
      if (ddragonPath.endsWith('.json')) {
        res.setHeader('Content-Type', 'application/json');
      }
      try {
        const fileExists = await fs.pathExists(filePath);
        if (!fileExists) {
          let response;

          try {
            response = await ddragon.get(ddragonPath);
          } catch (error) {
            // Rewrite request to get lower patch version.
            const patchPathParts = pathnameSplit[2].split('.');
            patchPathParts[1] = Number.parseInt(patchPathParts[1], 10) - 1;
            const lowerPatch = patchPathParts.join('.');
            const lowerPatchPath = [lowerPatch]
              .concat(pathnameSplit.slice(3))
              .join('/');
            response = await ddragon.get(lowerPatchPath);
          }

          const stream = await response.data;

          await fs.ensureFile(filePath);
          const writer = fs.createWriteStream(filePath);
          stream.pipe(writer);
          stream.pipe(res);
        } else {
          const readStream = fs.createReadStream(filePath);
          readStream.on('open', () => {
            readStream.pipe(res);
          });
        }
      } catch (error) {
        console.log('STATIC_ERROR', error);
        res.statusCode = 500;
        res.end(error.message);
      }
      break;
    case 'path':
      res.setHeader('Content-Type', 'text/plain');
      res.end(publicAPI.resourceDirectory);
      break;
    default:
      res.statusCode = 501;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Invalid Request');
      break;
  }
});

const publicAPI = {
  server,
  liveGame: {},
  championKeys: {},
  currentAccount: {},
  currentBuild: {},
  currentLanguage: '',
  currentPatch: '',
  resourceDirectory: '',
};

module.exports = publicAPI;
