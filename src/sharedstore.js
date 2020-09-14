const { ipcMain } = require('electron');


//const proData = require('./modules/electron-overlay/electron/proData');
//const divisionData = require('./modules/electron-overlay/electron/divisionData');

class SharedStore {
  constructor(data) {
    this.conf = data || {};
    this.listenToChanges();
  }

  listenToChanges() {
    ipcMain.on('lolSrOverlaySettingsChange', (e, data) => {
      log.info('lolSrOverlaySettingsChange ', data);
      this.mergeWith(data);
    });
  }

  mergeWith(conf) {
    this.conf = Object.assign({}, this.conf, conf);
  }

  has(key) {
    return this.conf.hasOwnProperty(key);
  }

  set(key, val) {
    log.info('Set shared store ', key, val);
    this.conf[key] = val;
  }

  get(key) {
    return this.conf[key];
  }

  clear() {
    this.conf = {};
  }
}

module.exports = new SharedStore({
 // proData,
 // divisionData,
});
