/*global __dirname, module */
const path = require('path');
const electron = require('electron');
const fs = require('fs-extra');
const store = require('./storeInstance');
const { app } = electron;

// Electron only allows execFile within ASAR.

const helperDllName = 'helper.dll';
let helperDllPath = isDev
  ? path.join(__dirname, 'helper', helperDllName)
  : path.join(
      app.getAppPath(),
      '..',
      '..',
      'resources',
      'helper',
      helperDllName
    );

async function injectDLLNode() {
  if (!is.windows()) {
    return null;
  }

  // Move the dll into an independent path and inject from there so that instllation doesn't fail

  let dllHolderDirectoryPath = path.join(
    app.getPath('userData'),
    '..',
    'Blitz-helpers',
    app.getVersion()
  );

  try {
    fs.ensureDirSync(dllHolderDirectoryPath);
    /**
     * helper.dll
     */
    let newHelperDllPath = path.join(dllHolderDirectoryPath, helperDllName);
    if (!fs.existsSync(newHelperDllPath)) {
      fs.copyFileSync(helperDllPath, newHelperDllPath);
    }
    helperDllPath = newHelperDllPath;
  } catch (e) {
    log.error(e);
  }

  const BlitzInjector = require('blitz-injector');
  const injector = require('node-dll-injector');
  const processName = 'LeagueClient.exe';

  const isLeagueRunning = injector.isProcessRunning(processName);

  const ErrorString = {
    1: 'Process is not open',
    2: 'Getting path name failed',
    3: 'Buffer too small for path name',
    4: 'Failed to allocate memory',
    5: 'Failed to write memory',
    6: 'Failed to create remote thread to load the DLL',
  };

  if (isLeagueRunning) {
    try {
      let leaguePID = BlitzInjector.findProcessId(processName);
      let savedPID = store.get('leaguePID');

      // if savedPID and runningLeaguePID is differnet then only inject otherwise do nothing

      if (savedPID !== leaguePID) {
        if (leaguePID === -1) {
          log.error('PID_ERROR: invalid pid');
          return null;
        }
        const eCode = BlitzInjector.injectDLL(
          leaguePID,
          `\\Blitz-helpers\\${app.getVersion()}\\helper.dll`
        );
        if (eCode) {
          log.info('112 1');
          store.set('leaguePID', leaguePID);
        } else {
          log.error(`112 0: ${ErrorString[eCode]}`);
        }
      }
    } catch (pidError) {
      log.error('Get PID error', pidError);
    }
  } else {
    return null;
  }
}

module.exports = injectDLLNode;
