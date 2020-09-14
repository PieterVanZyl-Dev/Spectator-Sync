//process.platform !== 'win32'

const electron = require('electron')
const {ipcMain} = electron
const sharedStore = require('./sharedStore');

ipcMain.on('isSROverlayEnabled', (e, enableOverlay) => {
    if (!is.windows()) return null;
    sharedStore.set('isSROverlayEnabled', enableOverlay);
  });

ipcMain.on('handleGameStartOverlays', (e, isTFT) => {
    if (sharedStore.get('isSROverlayEnabled') && !isTFT) {
      const injectOverlayDLL = require('./modules/injectOverLayDLL.js');
      injectOverlayDLL();
    }
  });

  ipcMain.on('stopOverlay', () => {
    if (!is.windows()) return null;
    if (!sharedStore.get('ElectronOverlay')) {
      sharedStore.set('ElectronOverlay', require('./modules/electron-overlay'));
    }
    let ElectronOverlay = sharedStore.get('ElectronOverlay');
    ElectronOverlay.closeWindow('sr-cs');
    ElectronOverlay.stopSR();
    sharedStore.set('isSROverlayStarted', false);
    ElectronOverlay.stopOverlays();
  });
  
  ipcMain.on('stopSRPolling', () => {
    const ElectronOverlay = sharedStore.get('ElectronOverlay');
    ElectronOverlay.stopSRPolling();
  });