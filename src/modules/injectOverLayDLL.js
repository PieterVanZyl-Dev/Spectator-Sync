/*global __dirname, module, setTimeout*/
const path = require('path');
const electron = require('electron');
const fs = require('fs-extra');
const store = require('./storeInstance');
const sharedStore = require('../sharedStore');
const { app } = electron;

const overlayDllName = 'n_overlay.dll';
let overlayDllPath = isDev
  ? path.join(__dirname, 'helper', overlayDllName)
  : path.join(
      app.getAppPath(),
      '..',
      '..',
      'resources',
      'helper',
      overlayDllName
    );

// Move the dll into an independent path and inject from there so that instllation doesn't fail
const dllHolderDirectoryPath = path.join(
  app.getPath('userData'),
  '..',
  'Blitz-helpers',
  app.getVersion()
);

try {
  fs.ensureDirSync(dllHolderDirectoryPath);
  /**
   * n_overlay.dll
   */
  const newOverlayDllPath = path.join(dllHolderDirectoryPath, overlayDllName);
  if (!fs.existsSync(newOverlayDllPath)) {
    fs.copyFileSync(overlayDllPath, newOverlayDllPath);
  }
  overlayDllPath = newOverlayDllPath;
} catch (e) {
  log.error(e);
}

async function injectDLLNode() {
  if (!is.windows()) {
    return null;
  }

  const BlitzInjector = require('blitz-injector');
  const processName = 'League of Legends.exe';

  const isLeagueRunning = BlitzInjector.isProcessRunning(processName);

  const ErrorString = {
    1: 'Process is not open',
    2: 'Getting path name failed',
    3: 'Buffer too small for path name',
    4: 'Failed to allocate memory',
    5: 'Failed to write memory',
    6: 'Failed to create remote thread to load the DLL',
  };

  function startOverlay() {
    if (
      !sharedStore.get('isTFTOverlayStarted') &&
      sharedStore.get('isTFTOverlayEnabled') &&
      sharedStore.get('isTFT')
    ) {
      log.info('===================== STARTING TFT =====================');
      const ElectronOverlay = require('./electron-overlay');
      ElectronOverlay.startTFT();
      ElectronOverlay.pollTFTLevels();
      sharedStore.set('isTFTOverlayStarted', true);
    }

    if (
      !sharedStore.get('isSROverlayStarted') &&
      sharedStore.get('isSROverlayEnabled') &&
      !sharedStore.get('isTFT')
    ) {
      log.info('===================== STARTING SR =====================');

      if (sharedStore.get('assignedRole') === 'support') {
        log.info('YOU ARE SUP, NOT YET');
        return;
      }
      const ElectronOverlay = require('./electron-overlay');
      ElectronOverlay.startSR();
      sharedStore.set('isTFTOverlayStarted', true);
    }
  }

  if (isLeagueRunning) {
    try {
      const leagueGameId = BlitzInjector.findProcessId(processName);
      const savedPID = store.get('leagueGameId');

      // if savedPID and runningleagueGameId is differnet then only inject otherwise do nothing
      if (savedPID !== leagueGameId) {
        if (leagueGameId === -1) {
          log.error('PID_ERROR: invalid pid');
          return null;
        }

        store.set('leagueGameId', leagueGameId);

        setTimeout(() => {
          const overlayDllEcode = BlitzInjector.injectDLL(
            leagueGameId,
            `\\Blitz-helpers\\${app.getVersion()}\\n_overlay.dll`
          );
          if (overlayDllEcode) {
            log.info('===================== 112 1 =====================');
            startOverlay();
          } else {
            log.error(`112 0: ${ErrorString[overlayDllEcode]}`);
          }
        }, 30000);
      } else {
        startOverlay();
      }
    } catch (pidError) {
      log.error('Get PID error', pidError);
    }
  } else {
    return null;
  }
}

module.exports = injectDLLNode;
