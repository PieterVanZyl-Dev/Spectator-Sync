// const ElectronApp = require('electron');
const { Application } = require('./electron/entry');
// const log = require('electron-log');

const appEntry = new Application();
// ElectronApp.disableHardwareAcceleration();

// ElectronApp.on('window-all-closed', () => {
//     if (process.platform !== 'darwin') {
//         ElectronApp.quit();
//     }
// });

// ElectronApp.on('activate', () => {
//     appEntry.activate();
// });

module.exports = appEntry;
