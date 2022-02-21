import fs from 'fs';
import JSONdb from 'simple-json-db';
import puppeteer from 'puppeteer-core';
// import StealthPlugin from 'puppeteer-extra-plugin-stealth';

/**
 * chromePath:  the path of the chrome executable in our pc
 * setup() :    initialize Puppeteer
 * cleanup():   clearnup Puppeteer
 * browser:     global Puppeteer browser instance
 * newPage():   get new page with default user agent and dimensions
 */

 /**
  * options: {headless, width, height}
  */
export class PuppeteerWrapper {
    constructor(logger, filePaths, options) {
        this._logger = logger;
        this._filePaths = filePaths;
        this._options = options || { headless: true };

        // Public
        this.chromePath = undefined;
        this.browser = undefined;

        this.db = new JSONdb('./settings.json');
    }

    //#region Public API setup - cleanup

    async setup() {
        const isChromePathSet = await this._setChromePath();
        if (!isChromePathSet) {
            return false;
        }

        const args = [];

        let width = this._options.width || 800;
        let height = this._options.height || 600;

        let x = 100;
        let y = 100;

        if (this._options.randomizeBrowserPosition === true) {
            x = Math.ceil(Math.random() * 1366);
            y = Math.ceil(Math.random() * 768);
        }

        const datahenTillUrl = this.db.get('datahen_till_url');

        args.push(`--window-size=${width},${height}`);
        args.push(`--window-position=${x},${y}`);
        // args.push(`--proxy-server=${datahenTillUrl}`);
        // args.push('--ignore-certificate-errors');
        // args.push('--ignore-certificate-errors-spki-list');
        args.push('--no-sandbox');

        // puppeteer.use(StealthPlugin());

        this._logger.logInfo("Setting up puppeteer...");
        this.browser = await puppeteer.launch({
            headless: this._options.headless,
            executablePath: this.chromePath,
            args
        });
        // console.log(await this.browser.userAgent());
        this._logger.logInfo("Puppeteer initialized");
        return true;
    }

    async cleanup() {
        if (this.browser) await this.browser.close();
    }

    async newPage() {
        await this.cleanup();
        await this.setup();

        const page = await this.browser.newPage();

        // await page.setExtraHTTPHeaders({
        //     'X-DH-Cache-Freshness': 'now'
        // });

        await this._initCDPSession(page);

        if (this._options.width) {
            await page._client.send('Emulation.clearDeviceMetricsOverride');
        }

        this.browser.on('targetcreated', async (target) => {
            const page = await target.page();
            this._initCDPSession(page);
        });

        return page;
    }

    //#endregion

    //#region Helpers
    async _initCDPSession(page) {
        try{
            const client = await page.target().createCDPSession();

            await client.send('Network.enable');

            // added configuration
            await client.send('Network.setRequestInterception', {
                patterns: [{ urlPattern: '*' }],
            });

            await client.on('Network.requestIntercepted', async e => {
                // console.log('EVENT INFO: ');
                // console.log(e.interceptionId);
                // console.log(e.resourceType);
                // console.log(e.isNavigationRequest);

                await client.send('Network.continueInterceptedRequest', {
                    interceptionId: e.interceptionId,
                });
            });
        } catch (exception) {

        }
    }

    async _setChromePath() {
        this.chromePath = await this._getSavedPath();

        if (this.chromePath) {
            if (fs.existsSync(this.chromePath)) return true;

            // The saved path does not exists
            this._logger.logError(`Saved Chrome path does not exists: ${this.chromePath}`);
        }

        // Try the default path
        const defaultPath = this._getDefaultOsPath();

        if (Array.isArray(defaultPath)) {
            for (let i = 0; i < defaultPath.length; i++) {
                this.chromePath = defaultPath[i];
                if (fs.existsSync(this.chromePath)) {
                    console.log(this.chromePath);
                    this.db.set('chrome_path', this.chromePath);
                    break;
                }
            }

            return true;
        } else {
            this.chromePath = defaultPath;

            if (fs.existsSync(this.chromePath)) {
                this.db.set('chrome_path', this.chromePath);
                return true;
            }
        }

        return false;
    }

    _getSavedPath() {
        return this.db.get('chrome_path');
    }

    _getDefaultOsPath() {
        if (process.platform === "win32") {
            return [
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Users\\Hendro\\AppData\\Google\\Chrome\\Application\\chrome.exe',
            ];
        } else {
            return '/usr/bin/google-chrome';
        }
    }

    //#endregion
}
