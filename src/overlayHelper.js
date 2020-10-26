//process.platform !== 'win32'

const electron = require('electron')
const {ipcMain} = electron
const sharedStore = require('./sharedStore');
const log = require('electron-log');

 

ipcMain.on('isSROverlayEnabled', (e, enableOverlay) => {
    sharedStore.set('isSROverlayEnabled', enableOverlay);
  });

ipcMain.on('handleGameStartOverlays', (e, isTFT) => {
      const injectOverlayDLL = require('./modules/injectOverLayDLL.js');
      log.info("Started HandleGameStartOverlays")
      injectOverlayDLL();
      //const injectDLLNode = require('./modules/injectOverLayDLL.js');
      //injectDLLNode();
      //setTimeout(start, 4000);

  });
  


  ipcMain.on('stopOverlay', () => {
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