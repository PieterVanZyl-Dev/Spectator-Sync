/*global module, setInterval, setTimeout, clearInterval*/
const { BrowserWindow, ipcMain } = require('electron');
const { screen, shell } = require('electron');
const path = require('path');
const axios = require('axios');
const { fileUrl, CONFIG } = require('../utils/utils');
const { nativeWrapper } = require('../../native-helper');
const apiServer = require('../../electronAPI');
//const proData = require('./proData');
//const divisionData = require('./divisionData');
const sharedStore = require('../../../sharedStore');
//const log = require('electron-log');
const get = require('lodash.get');
let currentLevel = 1;

let assignedRole;

let srMatchCS = [];
let howDidIDo;
let csChartXYPoints;
let interval = 0;
let goalCsPerMin = 0;
let csArrayForCompare;

const getRole = role => {
  switch (role) {
    case 'top':
    case 'TOP':
    case 'Top':
      return 'top';
    case 'JNG':
    case 'jng':
    case 'jungle':
    case 'JUNGLE':
      return 'jng';
    case 'MID':
    case 'mid':
    case 'Mid':
    case 'Middle':
    case 'middle':
    case 'MIDDLE':
      return 'mid';
    case 'ADC':
    case 'adc':
    case 'Adc':
    case 'support':
    case 'Support':
    case 'SUPPORT':
      return 'adc';
  }
};

const getRank = globRank => {
  if (globRank && globRank !== 'unranked' && globRank !== 'platinum+') {
    return globRank;
  } else {
    return 'gold';
  }
};

class Application {
  constructor() {
    this.markQuit = false;
    this.windows = new Map();
    this.tray = null;
    this.tftLevelPoll = null;
    this.liveSRGameTimer = null;
    this.hasOverlayStarted = false;
    this.summonerName = '';
    //this.csScanningOffset = 20;
    //this.refreshBenchmarkArray();
  }

  setSummonerName() {
    this.summonerName = get(apiServer, 'currentAccount.data.account.name', '');
  }

  getWindow(window) {
    return this.windows.get(window) || null;
  }

  startOverlay() {
    this.Overlay = require('electron-overlay');
    this.Overlay.start();
    this.setupIpc();
    let computedWidth;
    let computedHeight;
    // setTimeout(() => {
    //   this.Overlay.sendCommand({
    //     command: 'input.intercept',
    //     intercept: true,
    //   });
    // }, 1000);
    this.Overlay.setHotkeys([
      // { name: 'overlay.toggle', keyCode: 113, modifiers: { ctrl: true } },
      // { name: 'tft.toggle', keyCode: 114, modifiers: { ctrl: true } },
    ]);
    this.Overlay.setEventCallback((event, payload) => {
      if (event === 'game.input') {
        const window = BrowserWindow.fromId(payload.windowId);
        if (window) {
          const intpuEvent = this.Overlay.translateInputEvent(payload);
          // if (payload.msg !== 512) {
          //   console.log(event, payload)
          //   console.log(`translate ${JSON.stringify(intpuEvent)}`)
          // }
          if (intpuEvent) {
            window.webContents.sendInputEvent(intpuEvent);
          }
        }
      } else if (event === 'graphics.fps') {
        // console.log(event, payload);
        // const window = this.getWindow('StatusBar');
        // if (window) {
        //     window.webContents.send('fps', payload.fps);
        // }
      } else if (
        event === 'graphics.window.event.resize' ||
        event === 'graphics.window'
      ) {
        const { width, height } = payload;
        if (width === 0 || height === 0) return;
        const tftRate = this.getWindow('tft-rate');
        const csSrWindow = this.getWindow('sr-cs');

        if (csSrWindow) {
          let scale;
          if (!scale) {
            scale = screen.getDisplayMatching(csSrWindow.getBounds())
              .scaleFactor;
          }
          log.info('Display scale ', scale);

          if (!computedWidth && !computedHeight) {
            computedWidth = Math.round(csSrWindow.getBounds().width * scale);
            computedHeight = Math.round(csSrWindow.getBounds().height * scale);
          }
          csSrWindow.setSize(computedWidth, computedHeight);
          csSrWindow.webContents.setZoomFactor(scale);

          let y = Math.round(computedHeight - 75); // todo fix this hard coding
          let x = Math.round(width - (computedWidth + 2));
          csSrWindow.setPosition(x, y);

          this.Overlay.sendWindowBounds(csSrWindow.id, {
            rect: csSrWindow.getBounds(),
          });
        }

        if (!tftRate) return;
        const widgetWidth = Math.round(0.3835 * height);
        tftRate.setMinimumSize(widgetWidth, tftRate.getBounds().height);
        tftRate.setSize(widgetWidth, tftRate.getBounds().height);
        let rollBarWidth = 1.1375 * height;
        let minimapWidth = 0.1683 * height;
        let rollBarX = (width - minimapWidth - rollBarWidth) * 0.5;
        let x =
          Math.round(rollBarX + rollBarWidth - tftRate.getBounds().width) +
          7 +
          10;

        const rollBarY = height * 0.845;
        const y = Math.round(rollBarY - tftRate.getBounds().height);
        tftRate.setPosition(x, y);

        this.Overlay.sendWindowBounds(tftRate.id, {
          rect: tftRate.getBounds(),
        });
      } else if (event === 'game.hotkey.down') {
        if (payload.name === 'tft.toggle') {
          // this.createToolTip(true);
        }
      } else if (event === 'game.window.focused') {
        // console.log('\n', 'focusWindowId', payload.focusWindowId);
        BrowserWindow.getAllWindows().forEach(window => {
          window.blurWebView();
        });
        const focusWin = BrowserWindow.fromId(payload.focusWindowId);
        if (focusWin) {
          focusWin.focusOnWebView();
        }
      }
    });
  }
  addOverlayWindow(
    name,
    window,
    dragborder = 0,
    captionHeight = 0,
    transparent = false
  ) {
    this.setSummonerName();

    const display = screen.getDisplayNearestPoint(
      screen.getCursorScreenPoint()
    );

    this.Overlay.addWindow(window.id, {
      name,
      transparent,
      resizable: window.isResizable(),
      maxWidth: window.isResizable
        ? display.bounds.width
        : window.getBounds().width,
      maxHeight: window.isResizable
        ? display.bounds.height
        : window.getBounds().height,
      minWidth: window.isResizable ? 100 : window.getBounds().width,
      minHeight: window.isResizable ? 100 : window.getBounds().height,
      nativeHandle: window.getNativeWindowHandle().readUInt32LE(0),
      rect: Object.assign({}, window.getBounds()),
      caption: {
        left: dragborder,
        right: dragborder,
        top: dragborder,
        height: captionHeight,
      },
      dragBorderWidth: dragborder,
    });
    window.webContents.on('paint', (event, dirty, image) => {
      if (this.markQuit) {
        return;
      }

      const scale = screen.getDisplayMatching(window.getBounds()).scaleFactor;
      const width = Math.round(image.getSize().width / scale);
      const height = Math.round(image.getSize().height / scale);
      this.Overlay.sendFrameBuffer(
        window.id,
        image.resize({ width, height }).getBitmap(),
        width,
        height
      );
    });

    window.begin;
    window.on('ready-to-show', () => {
      window.focusOnWebView();
    });
    // window.on('resize', () => {
    //   this.Overlay.sendWindowBounds(window.id, { rect: window.getBounds() });
    // });
    // window.on('move', () => {
    //   this.Overlay.sendWindowBounds(window.id, { rect: window.getBounds() });
    // });
    const windowId = window.id;
    window.on('closed', () => {
      this.Overlay.closeWindow(windowId);
    });
    window.webContents.on('cursor-changed', (event, type) => {
      let cursor;
      switch (type) {
        case 'default':
          cursor = 'IDC_ARROW';
          break;
        case 'pointer':
          cursor = 'IDC_HAND';
          break;
        case 'crosshair':
          cursor = 'IDC_CROSS';
          break;
        case 'text':
          cursor = 'IDC_IBEAM';
          break;
        case 'wait':
          cursor = 'IDC_WAIT';
          break;
        case 'help':
          cursor = 'IDC_HELP';
          break;
        case 'move':
          cursor = 'IDC_SIZEALL';
          break;
        case 'nwse-resize':
          cursor = 'IDC_SIZENWSE';
          break;
        case 'nesw-resize':
          cursor = 'IDC_SIZENESW';
          break;
        case 'ns-resize':
          cursor = 'IDC_SIZENS';
          break;
        case 'ew-resize':
          cursor = 'IDC_SIZEWE';
          break;
        case 'none':
          cursor = '';
          break;
      }
      if (cursor) {
        // this.Overlay!.sendCommand({ command: 'cursor', cursor });
      }
    });
  }

  closeAllWindows() {
    const windows = this.windows.values();
    for (const window of windows) {
      window.close();
    }
  }
  closeWindow(name) {
    const window = this.windows.get(name);
    if (window) {
      this.Overlay.closeWindow(window.id);
      window.close();
    }
  }
  hideWindow(name) {
    const window = this.windows.get(name);
    if (window) {
      window.hide();
    }
  }
  showAndFocusWindow(name) {
    const window = this.windows.get(name);
    if (window) {
      window.show();
      window.focus();
    }
  }
  reloadTFT() {
    let level = sharedStore.get('patchVersion')
      ? nativeWrapper.getLevel(
          this.summonerName,
          sharedStore.get('patchVersion')
        )
      : nativeWrapper.getLevel(this.summonerName);
    if (level === 1) {
      level = 2;
    }
    if (level > 9 || level < 1) return;
    if (level === currentLevel) return;
    this.reloadUrlWindow('tft-rate', `overlay/tft-rate.html?level=${level}`);
    currentLevel = level;
  }

  pollTFTLevels() {
    this.tftLevelPoll = setInterval(() => {
      this.reloadTFT();
    }, 1000);
  }

  startTFT() {
    if (!this.hasOverlayStarted) {
      this.startOverlay();
      this.hasOverlayStarted = true;
    }
    currentLevel = 2;

    this.createWindow(
      'tft-rate',
      {
        width: 460,
        height: 350,
        resizable: false,
      },
      { filePath: 'overlay/tft-rate.html?level=2', debug: false }
    );
    // reread level every 1 sec

    this.createWindow(
      'tft-items',
      {
        width: 388,
        height: 200,
        x: 50,
        y: 0,
      },
      { filePath: 'overlay/tft-items.html', debug: false }
    );
  }

  // Finds the current benchmark array CS based on current game interval
  getGoal(comparisonCsArray, interval) {
    if (interval == 0) {
      return 0;
    } else if (comparisonCsArray[interval - 1] != undefined) {
      return comparisonCsArray[interval - 1];
    } else {
      const mins = comparisonCsArray.length * 0.5;
      const lastKnownCS = comparisonCsArray[comparisonCsArray.length - 1];
      return Math.round((lastKnownCS / mins) * (interval / 2));
    }
  }

  // Calculate cs/min
  csPerMin(cs, seconds) {
    return (cs / (seconds / 60)).toFixed(1);
  }

  // Convert the benchmark CS at the current interval from total CS to CS/min.
  getCsPerMinGoal(comparisonCsArray, interval, seconds) {
    if (interval == 0) {
      return 0;
    } else if (comparisonCsArray[interval - 1] != undefined) {
      return comparisonCsArray[interval - 1] / (seconds / 60).toFixed(1);
    } else {
      // If we hit the end of the array, use the last known CS to handle any further points
      const mins = comparisonCsArray.length * 0.5;
      const lastKnownCS = comparisonCsArray[comparisonCsArray.length - 1];
      const csPerMin = lastKnownCS / mins;
      return csPerMin;
    }
  }

  // Charting methods //////////////////
  // (Step 1): Slice arrays to cap at length 10
  getCSatInterval(csArray, interval) {
    if (interval < 11) {
      return csArray.slice(0, interval);
    } else if (csArray[interval - 1] != undefined) {
      return csArray.slice(interval - 11, interval);
    } else {
      const mins = csArray.length * 0.5;
      const lastKnownCS = csArray[csArray.length - 1];
      csArray.push(Math.round((lastKnownCS / mins) * (interval / 2)));
      log.info(Math.round((lastKnownCS / mins) * (interval / 2)));
      return csArray.slice(interval - 11, interval);
    }
  }

  getCSAtIntervalForPlayer(csArray, interval) {
    if (csArray.length >= interval) {
      return this.getCSatInterval(csArray, interval);
    } else {
      const missingCSValueSize = 10 - csArray.length;
      if (missingCSValueSize > 0) {
        const oldestAvailableCS = csArray[0];
        return [
          ...Array(missingCSValueSize).fill(oldestAvailableCS),
          ...csArray,
        ];
      } else {
        return csArray;
      }
    }
  }

  // (Step 2): Create an array of pecentages comparing user CS and pro CS at every interval
  // We use these percentage to determine the y-axis point (above for > 1, below for < 1)
  // ex. [0.84, 0.73, 1.12]
  compareCS(myCS, benchmarkCS, interval) {
    let comparisonArray = [];
    const benchmarkArray = this.getCSatInterval(benchmarkCS, interval);
    const meArray = this.getCSAtIntervalForPlayer(myCS, interval);

    log.info(benchmarkArray, 'benchmark cs array');
    log.info(meArray, 'meArray cs array');

    for (let index = 0; index < meArray.length; index++) {
      const goalPercentMet =
        Math.round((meArray[index] / benchmarkArray[index]) * 100) / 100;

      if (!Number.isNaN(goalPercentMet)) {
        comparisonArray.push(goalPercentMet);
      } else {
        comparisonArray.push(0);
      }
    }
    return comparisonArray;
  }
  // (Step 3): Create an array of X and Y value points to use for the chart
  // Take the comparison percentage array from compareCS() and build an
  // object of x,y values to chart
  // ex. [{x: 12, y: 30}, {x: 18, 12}]
  getPolylinePoints(comparisonArray, chartHeight) {
    const chartYpoints = [];
    const chartXpoints = [];
    const chartXYpoints = [];
    const midPoint = chartHeight / 2;
    for (let index = 0; index < comparisonArray.length; index++) {
      const currComparison = comparisonArray[index];
      chartXpoints.push(index * (60 / 10));

      // amplification for where on the Y axis the point falls
      switch (true) {
        case currComparison >= 1.1: // if +10% and above
          chartYpoints.push(0);
          break;
        case currComparison >= 1.08: // if between +10% - +8%
          chartYpoints.push(2.4);
          break;
        case currComparison >= 1.06: // if between +6 - +8%
          chartYpoints.push(4.8);
          break;
        case currComparison >= 1.04: // if between +4% - +6%
          chartYpoints.push(7.2);
          break;
        case currComparison >= 1.02: // if between +2% - +4%
          chartYpoints.push(9.6);
          break;
        case currComparison === 1 || currComparison === 0: // exactly at goal
          chartYpoints.push(midPoint);
          break;
        case currComparison >= 0.9: // if between 0% - -.10%
          chartYpoints.push(14);
          break;
        case currComparison >= 0.8: // if between -10% - -20%
          chartYpoints.push(16);
          break;
        case currComparison >= 0.7: // if between -20% - -30%
          chartYpoints.push(18);
          break;
        case currComparison > 0.6: // if between -30% - -40%
          chartYpoints.push(20);
          break;
        case currComparison > 0.5: // if between -40% - -50%
          chartYpoints.push(22);
          break;
        case currComparison <= 0.5: // if -50% and below
          chartYpoints.push(24);
          break;
        default:
          chartYpoints.push(midPoint);
      }
    }

    for (let index = 0; index < chartXpoints.length; index++) {
      chartXYpoints.push({ x: chartXpoints[index], y: chartYpoints[index] });
    }

    return chartXYpoints;
  }

  // (Step 4): Convert X Y array from getPolylinePoints() to a string
  // for the actual <polyline> SVG element
  // ex. "12,30 18,12"
  convertPointsToString(points) {
    let pointsString = '';

    if (points !== null) {
      for (let index = 0; index < points.length; index++) {
        pointsString += points[index].x + ',' + points[index].y + ' ';
      }
    }

    return pointsString;
  }

  getApproxCS(compareArr, interval) {
    let lastCS = compareArr[compareArr.length - 1];
    if (interval < compareArr.length) {
      return compareArr[interval - 1];
    } else if (interval === compareArr.length) {
      return lastCS;
    } else {
      let csPerThirtySec = lastCS / compareArr.length;
      let futureOffset = interval - compareArr.length;
      return lastCS + csPerThirtySec * futureOffset;
    }
  }

  handleLiveMatch() {
    let csWindow = this.getWindow('sr-cs');
    if (!csWindow) return;
    if (sharedStore.get('assignedRole') === 'support') {
      this.closeWindow(csWindow);
    }
    if (sharedStore.get('assignedRole')) {
      let gameTimer = Number(
        nativeWrapper.getGameTime(sharedStore.get('patchVersion'))
      ).toFixed();
      if (gameTimer >= 15) {
        if (sharedStore.get('isSRReconnect')) {
          if (this.csScanningOffset) {
            this.csScanningOffset--;
            return;
          }
          this.csScanningOffset = 15;
          sharedStore.set('isSRReconnect', false);
        }
        let cs = nativeWrapper.getCS(sharedStore.get('patchVersion'));
        if (cs === -1 || cs < 0 || cs > 500) cs = 0;

        let csDiff = 0;

        if (gameTimer % 30 === 0) {
          // Every 30s
          interval = Math.floor(gameTimer / 30);
          if (srMatchCS.length === 0 && interval > 0) {
            // it means overlay is started mid game
            log.info(' -- Mid game Overlay start --- ');
          }
          srMatchCS.push(cs);
          goalCsPerMin = this.getCsPerMinGoal(
            csArrayForCompare,
            interval,
            gameTimer
          ).toFixed(1);
          howDidIDo = this.compareCS(srMatchCS, csArrayForCompare, interval);
          csChartXYPoints = this.getPolylinePoints(howDidIDo, 24);
          // new chart data prep
          let compareCSVal = this.getApproxCS(csArrayForCompare, interval);
          csDiff = cs - compareCSVal;
          log.info(
            '********************************************** TARGET CS ',
            compareCSVal
          );

          log.info('********************************************** MY CS ', cs);
        }

        let goal = this.getGoal(csArrayForCompare, interval);
        let csPerMin = this.csPerMin(cs, gameTimer);

        let settingsStr = JSON.stringify({
          displayOption: sharedStore.get('displayOption'), // Second arg is for default
          benchmark: sharedStore.get('benchmark'),
          leagueDivision: sharedStore.has('leagueDivision')
            ? sharedStore.get('leagueDivision')
            : getRank(sharedStore.get('leagueRank')),
          proPlayer: sharedStore.get('pros')[assignedRole],
          calculatedCS: sharedStore.get('calculatedCS'),
        });

        csWindow.webContents.send('csInfo', {
          csDiff,
          cs,
          interval: interval,
          goal: goal,
          csPerMin: csPerMin,
          csPerMinGoal: goalCsPerMin,
          csChartXYPoints: this.convertPointsToString(csChartXYPoints),
          latestComparison:
            csPerMin && goalCsPerMin
              ? Math.round((csPerMin / goalCsPerMin) * 100) / 100
              : 0,
          latestPoint:
            csChartXYPoints && csChartXYPoints.length
              ? csChartXYPoints[csChartXYPoints.length - 1]
              : { x: 0, y: 0 },
          settings: settingsStr,
        });
      }
    }
  }

  listenForLiveSRMatch() {
    this.liveSRGameTimer = setInterval(() => this.handleLiveMatch(), 1000);
  }

  /* refreshBenchmarkArray() {
    log.info('== Refreshing the benchmark array ==');
    csArrayForCompare = null;
    assignedRole = getRole(sharedStore.get('assignedRole'));

    log.info('Assigned role ', assignedRole);
    let selectedBenchmark = sharedStore.get('benchmark');

    log.info('Selected Benchmark ', selectedBenchmark);

    let leagueDivision = sharedStore.has('leagueDivision')
      ? sharedStore.get('leagueDivision')
      : getRank(sharedStore.get('leagueRank'));

    log.info('League division ', leagueDivision);

    let proPlayer =
      sharedStore.get('pros') && sharedStore.get('pros')[assignedRole];

    log.info('Pro player ', proPlayer);

    let displayOption = sharedStore.get('displayOption');

    log.info('Display Option', displayOption);

    let calculatedCS = sharedStore.get('calculatedCS');

    log.info('Calculated CS ', calculatedCS);

    if (selectedBenchmark === 'division') {
      csArrayForCompare = divisionData[leagueDivision][assignedRole];
    } else if (selectedBenchmark === 'pro') {
      csArrayForCompare = proData[proPlayer];
    } else {
      // @todo: remove this part once we have self and other benchmarks
      csArrayForCompare = proData['faker'];
    }
  } */

  startSR() {
    srMatchCS = [];
    howDidIDo = null;
    csChartXYPoints = null;
    interval = 0;

    //this.refreshBenchmarkArray();
    this.listenForLiveSRMatch(); // Every 1s

    if (!this.hasOverlayStarted) {
      this.startOverlay();
      this.hasOverlayStarted = true;
    }
    if (sharedStore.get('assignedRole') === 'support') return;
    this.createWindow(
      'sr-cs',
      {
        width: 186,
        height: 168,
        resizable: true,
      },
      { filePath: 'overlay/sr-cs.html', debug: false }
    );

/*     ipcMain.on('srOverlaySettingsChange', () => {
      //this.refreshBenchmarkArray();
    }); */

    this.waitForRole()
      .then(() => {
        let assignedRole = getRole(sharedStore.get('assignedRole'));
        log.info('Role found', assignedRole);
        this.refreshBenchmarkArray();
      })
      .catch(() => {
        log.error('Could not find role');
      });
  }

  stopSR() {
    const cs = nativeWrapper.getCS(sharedStore.get('patchVersion'));
    log.info('~~~~~~~~ sr ended, here is cs ~~~~~~~~');
    srMatchCS.splice(srMatchCS.length, 1, cs);
    log.info(srMatchCS);
    interval = 0;
    csChartXYPoints = null;
    srMatchCS = [];
    clearInterval(this.liveSRGameTimer);
    sharedStore.set('assignedRole', null);
    assignedRole = null;
    ipcMain.removeListener(
      'srOverlaySettingsChange',
      this.refreshBenchmarkArray
    );
  }

  stopSRPolling() {
    if (this.liveSRGameTimer) {
      log.info('======== STOP POLLING FOR CS OVERLAY ======== ');
      clearInterval(this.liveSRGameTimer);
      this.liveSRGameTimer = null;
    }
  }

  activate() {}

  waitForRole() {
    let i = 0;
    return new Promise((resolve, reject) => {
      setInterval(() => {
        if (sharedStore.get('assignedRole')) {
          i++;
          resolve();
        }
        if (i > 240) {
          reject();
        }
      }, 250);
    });
  }
  quit() {
    this.markQuit = true;
    this.closeAllWindows();
    if (this.tray) {
      this.tray.destroy();
    }
    if (this.Overlay) {
      this.Overlay.stop();
    }
  }
  stopOverlays() {
    if (this.Overlay) {
      this.Overlay.stop();
      this.hasOverlayStarted = false;
    }
  }
  stopPollingTFT() {
    if (this.tftLevelPoll) {
      clearInterval(this.tftLevelPoll);
      this.tftLevelPoll = null;
    }
  }
  openLink(url) {
    shell.openExternal(url);
  }

  reloadUrlWindow(name, filePath) {
    const window = this.getWindow(name);
    window.loadURL(fileUrl(path.join(CONFIG.distDir, filePath)));
    window.setSize(window.getBounds().width, window.getBounds().height + 1);
    setTimeout(() => {
      window.webContents.setZoomFactor(1);
    }, 1000);
  }
  createWindow(
    name,
    {
      width = 500,
      height = 500,
      x = 0,
      y = 0,
      resizable = false,
      // useContentSize: true,
      frame = false,
    }, //browser window option
    {
      filePath,
      debug = false,
      isMultiple = false,
      dragBorder = 0,
      captionHeight = 0,
    }
  ) {
    if (['StatusBar', 'MainOverlay', 'OverlayTip'].includes(name)) {
      throw 'This name has special meaning, do not use!';
    }
    let window;
    if (!isMultiple) {
      window = this.getWindow(name);

      if (window) return;
    }

    window = new BrowserWindow({
      width,
      height,
      x,
      y,
      resizable,
      frame,
      show: debug,
      transparent: !debug,
      webPreferences: {
        offscreen: !debug,
        // scale overlay accordingly
        // zoomFactor: 1 / scale,
        // transparent: true,
      },
    });
    this.windows.set(name, window);
    window.on('closed', () => {
      this.windows.delete(name);
    });
    window.webContents.on('new-window', (e, url) => {
      e.preventDefault();
      shell.openExternal(url);
    });
    window.loadURL(fileUrl(path.join(CONFIG.distDir, filePath)));

    this.addOverlayWindow(name, window, dragBorder, captionHeight, true);
    if (debug)
      window.webContents.openDevTools({
        mode: 'detach',
      });
    setTimeout(async () => {
      window.webContents.setZoomFactor(1);
      window.setSize(window.getBounds().width, window.getBounds().height + 1);
      this.localizeOverlays();
    }, 3000);
  }

  async getlocalizedItems(language) {
    return axios
      .get(
        `https://solomid-resources.s3.amazonaws.com/blitz/tft/localized/items-919/${language}.json`
      )
      .catch(err =>
        log.error('======== OVERLAY GETLOCALIZEDITEMS ERROR ======== ', err)
      );
  }

  async localizeOverlays(language = null) {
    if (!language) language = get(apiServer, 'currentLanguage', 'en');
    for (var [key, win] of this.windows) {
      if (key === 'tft-items') {
        const locales = await this.getlocalizedItems(language);
        if (locales) win.webContents.send('changeLanguage', locales.data.items);
      }
      if (key === 'sr-cs') {
        const locales = require(`../../../i18nResources/${language}.overlay`);
        if (locales) win.webContents.send('changeLanguage', locales);
      }
    }
  }

  setupIpc() {
    // ipcMain.once('start', () => {
    //     if (!this.Overlay) {
    //         this.startOverlay();
    //         this.createToolTip();
    //         this.createFpsWindow();
    //     }
    // });
    ipcMain.on('startIntercept', () => {
      this.Overlay.sendCommand({
        command: 'input.intercept',
        intercept: true,
      });
    });
    ipcMain.on('stopIntercept', () => {
      this.Overlay.sendCommand({
        command: 'input.intercept',
        intercept: false,
      });
    });
    ipcMain.on('changeLanguage', async (e, language) => {
      log.info('======== OVERLAY LANG ======== ', language);
      this.localizeOverlays(language);
    });
  }
}
module.exports = { Application };
