/* global __dirname, module */
const path = require('path');
const CONFIG = {};
CONFIG.distDir = path.join(__dirname, '../');

function fileUrl(str) {
  let pathName = path.resolve(str).replace(/\\/g, '/');
  // Windows drive letter must be prefixed with a slash
  if (pathName[0] !== '/') {
    pathName = '/' + pathName;
  }

  return encodeURI('file://' + pathName);
}

module.exports = { fileUrl, CONFIG };
