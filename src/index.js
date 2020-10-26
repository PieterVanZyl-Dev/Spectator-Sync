const log = require('electron-log');
const { ipcRenderer } = require('electron')



ipcRenderer.on('backtest', (event, arg) => {
    console.log(arg) // prints "pong"
  })
  ipcRenderer.send('test')



log.transports.console.format = '{h}:{i}:{s} {text}';
let l = log.transports.file.getFile();
ipcRenderer.send("setIsTFT", !1),
log.info("======= STARTING SR OVERLAYS ======="),
ipcRenderer.send("handleGameStartOverlays", !1)




log.info("[LCU] ------ GAME BEGAN ------")

log.info("======= SR GAME =======")
log.info("======= STARTING SR OVERLAYS =======")




//ipcRenderer.send('start')



