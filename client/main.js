'use strict';

const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;

const path = require('path');
const url = require('url');

let mainWindow;
app.on('ready', () => {
  mainWindow = new BrowserWindow({width: 480, height: 640, resizable: false, title: 'Pixels!'});
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }));
  mainWindow.on('closed', function () {
    mainWindow = null;
  });
  // mainWindow.webContents.openDevTools();
});
app.on('window-all-closed', function () {
  app.quit();
});
