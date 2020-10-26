const { app, BrowserWindow } = require('electron');
const path = require('path');
const sharedStore = require('./sharedStore');
const os = require('os');

const log = require('electron-log');

let mainWindow;
const osVersion = os.release();

sharedStore.mergeWith({
  patchVersion: null,
  isTFT: false,
  isSROverlayEnabled:
    Number(osVersion.split('.')[0]) === 10 ||
    osVersion.includes('Windows NT 10.0') ||
    osVersion.includes('Windows 10.0'),
  isSRReconnect: false,
  isSROverlayStarted: false,
  isTFTOverlayEnabled: true,
  isTFTOverlayStarted: false,
  ElectronOverlay: null,
  leagueRank: null,
  assignedRole: null,
});

require('./overlayHelper.js');


log.transports.console.format = '{h}:{i}:{s} {text}';
log.transports.file.getFile();



if (!sharedStore.get('ElectronOverlay') && (process.platform == 'win32')) {
 sharedStore.set('ElectronOverlay', require('./modules/electron-overlay'));
}

const DEFAULT_WIDTH = 1350;
const DEFAULT_HEIGHT = 800;



// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true,
      webSecurity: false,
    },
    width: DEFAULT_WIDTH,
    height:  DEFAULT_HEIGHT,
    minHeight: 720,
    minWidth: 1080,
    title: 'StreamSync',
    //icon: iconPathHighRes,
    frame: false,
    hasShadow: false,
    backgroundColor: '#1b2838',
  });
  // and load the index.html of the app.
  mainWindow.loadURL('file://' + __dirname + '/index.html');


  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
