const electron = require('electron');
const { globalShortcut } = require('electron');
const XLSX = require('xlsx');
const axios = require('axios');
const https = require('https');

// Module to control application life.
const app = electron.app;
const ipcMain = electron.ipcMain;

// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow;
const path = require('path');
const url = require('url');
const JSONdb = require('simple-json-db');
const dbSetting = new JSONdb('./settings.json');
const agent = new https.Agent({
	rejectUnauthorized: false
});

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

async function createWindow() {

	// Create the browser window.
	mainWindow = new BrowserWindow({
		width: 1366,
		height: 768,
		icon: './assets/images/ms-icon-310x310.png',
		webPreferences: {
			worldSafeExecuteJavaScript: true, // required for Electron 12+
			contextIsolation: false, // required for Electron 12+
			nodeIntegration: true,
			enableRemoteModule: true,
			webviewTag: true,
			devTools: true
		}
	});

	mainWindow.maximize();
	mainWindow.setMenuBarVisibility(false);

	// and load the index.html of the app.
	let fileHtml = 'index.html';

	mainWindow.loadURL(
		url.format({
			pathname: path.join(__dirname, fileHtml),
			protocol: 'file:',
			slashes: true
		})
	);

	// Open the DevTools.
	mainWindow.webContents.openDevTools();

	mainWindow.setTitle(`${app.getName()}-${app.getVersion()}`);

	// Emitted when the window is closed.
	mainWindow.on('closed', function () {
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		mainWindow = null;
	});

	// globalShortcut.register('Control+Shift+I', () => {
	 	// dialog.showMessageBox({ title: "Google Place Scraper", message: "Google Place Scraper by Hendro Wibowo"});
	 	// return false;
	// });
}

function reloadApp() {
	app.relaunch({ args: process.argv.slice(1).concat(['--relaunch']) })
	app.exit(0)
}

if (app.setAboutPanelOptions) app.setAboutPanelOptions({
	applicationName: 'Google Place Scraper',
	applicationVersion: '1.0.1',
	copyright: "(C) 2021-present Google Place Scraper Team"
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', function () {
	// On OS X it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate', function () {
	// On OS X it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (mainWindow === null) {
		createWindow();
	}
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
const dialog = electron.dialog;
const EXTENSIONS = "xls|xlsx|xlsm|xlsb|xml|csv|txt|dif|sylk|slk|prn|ods|fods|htm|html".split("|");
ipcMain.on('export-to-xlsx', async function (evt, data) {
	if (data.length > 0) {
		const wb = XLSX.utils.book_new();
		wb.Props = {
			Title: "Google Place Scraper Results",
			Subject: "Google Place Scraper Results",
			Author: "Google Place Scraper v1.0.0",
			CreatedDate: new Date()
		};
		wb.SheetNames.push("Sheet 1");

		const dbData = data; //db.get('businesses');
		const wbData = [
			[
				"Business Name",
				"Rating",
				"Jumlah Review",
				"Alamat",
				"Website",
				"Phone",
				"Latitude",
				"Longitude"
			]
		];

		for (let i = 0; i < dbData.length; i++) {
			if (i >= 0) {
				wbData.push(Object.values(dbData[i]));
			}
		}

		const ws = XLSX.utils.aoa_to_sheet(wbData);

		wb.Sheets["Sheet 1"] = ws;

		const o = await dialog.showSaveDialog({
			title: 'Save file as',
			filters: [{
				name: "Spreadsheets",
				extensions: EXTENSIONS
			}]
		});

		XLSX.writeFile(wb, o.filePath);

		dialog.showMessageBox({ message: "Data berhasil diekspor ke " + o.filePath, buttons: ["OK"] });
	} else {
		dialog.showErrorBox("Belum ada data", "Belum ada data yang di-scrape. Silahkan melakukan pencarian terlebih dahulu.");
	}
});

ipcMain.on('chrome-not-found', async function (evt, data) {
	await dialog.showErrorBox("Google Chrome tidak ditemukan", "Tidak dapat menemukan Google Chrome di komputer Anda. Kemungkinan Anda belum meng-install-nya atau pilih file instalasi Chrome Anda secara manual.");

	const chromePathDialog = await dialog.showOpenDialog({
		title: "Pilih file instalasi Google Chrome",
	});

	if (!chromePathDialog.canceled) {
		const chromePath = chromePathDialog.filePaths[0];
		dbSetting.set("chrome_path", chromePath);

		reloadApp();
    }
});

ipcMain.on('license-updated', async function (evt, data) {
	if (data == 'success') {
		await dialog.showMessageBox({
			title: 'License Key Aplikasi',
			message: 'License Key yang Anda masukkan berhasil divalidasi oleh server. Aplikasi akan dimuat ulang.',
		});
		await reloadApp();
	} else {
		await dialog.showErrorBox('License Key Aplikasi', 'License Key yang Anda masukkan salah. Silahkan ulangi lagi.');
    }
});

ipcMain.on('empty-search-query', async function (evt, data) {
	dialog.showMessageBox({
		title: "Pencarian",
		message: data,
    })
});

ipcMain.on('scraping-done', async function(evt, data) {
	dialog.showMessageBox({
		title: 'Google Place Scraper',
		message: data
	});
});
