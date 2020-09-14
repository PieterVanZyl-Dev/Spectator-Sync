/*global __dirname, module, process, Buffer, console*/
const path = require('path');
var ffi = require('ffi-napi');
const electron = require('electron');
//const wchar_t = require('./wchar_t')
const { app } = electron;

const BIN_PATH = path.join(__dirname, '/helper/');

function loadDll(dllDir) {
  let binPath = dllDir ? dllDir : BIN_PATH;
  process.chdir(binPath);
  var helper = ffi.Library('native-utils.dll', {
    getPathFromProcessName: ['int', ['string', 'string']],
    getCS: ['int', ['int']],
    getLevel: ['int', ['string', 'int']],
    getGameTime: ['float', ['int']],
  });
  const getPathFromProcessName = path => {
    var buffer = Buffer.alloc(1024);
    var errorCode = helper.getPathFromProcessName(path, buffer);
    var errorOrPath = buffer
      .toString('ucs2')
      .replace(/\0/g, '')
      .trim();
    if (errorCode) {
      var err = new Error(errorOrPath);
      err.code = errorCode;
      throw err;
    }
    return errorOrPath;
  };
  return {
    ...helper,
    getPathFromProcessName,
  };
}

const nativeWrapper = initNativeWrapper();
if (nativeWrapper) console.log('NATIVE WRAPPER LOADED', nativeWrapper);

function initNativeWrapper() {

  try {
    if (true) return loadDll();

    // Production DLL Path
    const DLL_PATH = path.join(
      app.getAppPath(),
      '..',
      '..',
      'resources',
      'helper'
    );
    return loadDll(DLL_PATH);
  } catch (error) {
    console.error('Error load dll: ', error);
    return null;
  }
}

module.exports = {
  nativeWrapper,
};
