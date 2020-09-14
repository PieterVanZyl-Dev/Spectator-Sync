/* global module */
// Make the electron store instance reusable.
const Store = require('electron-store');
const store = new Store();

module.exports = store;
