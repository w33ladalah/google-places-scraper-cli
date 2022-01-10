'use strict';

var _logger2 = require('./lib/logger');

var _filePaths2 = require('./lib/file-paths.js');

var _puppeteerWrapper2 = require('./lib/puppeteer-wrapper');

var _config = require('./config');

var _jquery = require('jquery');

var _jquery2 = _interopRequireDefault(_jquery);

var _simpleJsonDb = require('simple-json-db');

var _simpleJsonDb2 = _interopRequireDefault(_simpleJsonDb);

var _axios = require('axios');

var _axios2 = _interopRequireDefault(_axios);

var _delay = require('delay');

var _delay2 = _interopRequireDefault(_delay);

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _md = require('md5');

var _md2 = _interopRequireDefault(_md);

var _date = require('date.js');

var _date2 = _interopRequireDefault(_date);

var _moment = require('moment');

var _moment2 = _interopRequireDefault(_moment);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

//#endregion

//#region Setup - Dependency Injection-----------------------------------------------
//#region Imports
// Library ----------------------------------------------------------------------------------
const _logger = new _logger2.Logger();
const _filePaths = new _filePaths2.FilePaths(_logger, "gmap-scrapper");
const _puppeteerConfig = { headless: false, width: 900, height: 650, args: ['--lang=en-EN,en'] };
const _puppeteerWrapper = new _puppeteerWrapper2.PuppeteerWrapper(_logger, _filePaths, _puppeteerConfig);
let scrapedData = [];
//#endregion

//#region Main ---------------------------------------------------------------------

async function main() {
	const searchQuery = process.argv.slice(2);
	const searchLimit = process.argv.slice(3) || 5;

	await GMapScrapper(searchQuery, searchLimit);
}

async function getPageData(url, page) {
	console.log(`Processing ${url}...`);

	await page.goto(url);

	//Shop Name
	await page.waitForSelector(".x3AX1-LfntMc-header-title-title span");
	const shopName = await page.$eval(_config.CSS_SELECTOR['shop_name'], name => name.textContent);

	await page.waitForSelector(".x3AX1-LfntMc-header-title-ij8cu-haAclf");
	const reviewRating = await page.$eval(_config.CSS_SELECTOR['rating'], rating => rating.textContent);

	let reviewCount = 0;
	try {
		await page.waitForSelector(".h0ySl-wcwwM-E70qVe-list");
		reviewCount = parseInt((await page.$eval(_config.CSS_SELECTOR['reviews'], review => review.textContent)));
	} catch (exception) {
		console.error("No reviews found.");
	}

	//Shop Address
	await page.waitForSelector(".QSFF4-text.gm2-body-2:nth-child(1)");
	let address = await page.$$eval(_config.CSS_SELECTOR['address'], divs => Array.from(divs).map(div => div.innerText).find(address => address));

	if (address === undefined) {
		address = await page.$$eval(_config.CSS_SELECTOR['address_backup'], divs => divs[1]);
	}

	//Website
	try {
		await page.waitForSelector(_config.CSS_SELECTOR['website'], { timeout: 3 });
	} catch (ex) {
		console.log('No element found.');
	}

	const website = await page.$$eval(_config.CSS_SELECTOR['website'], divs => Array.from(divs).map(div => div.innerText).find(link => /^((https?|ftp|smtp):\/\/)?(www.)?[a-z0-9]+(\.[a-z]{2,}){1,3}(#?\/?[a-zA-Z0-9#]+)*\/?(\?[a-zA-Z0-9-_]+=[a-zA-Z0-9-%]+&?)?$/.test(link)));

	console.log(website || 'No website');

	const phone = await page.$$eval(_config.CSS_SELECTOR['phone'], divs => Array.from(divs).map(div => div.innerText).find(phone => phone));

	console.log(phone || 'No phone');

	const latLong = await getLatLong(url);

	//Hours of works
	const workHours = await getWorkHours(page);

	//Images
	const images = await getImages(page);

	//Reviews
	const allReviews = await getReviews(page);

	let returnObj = {};

	try {
		returnObj = {
			shop: shopName.trim(),
			rating: reviewRating === undefined ? '' : reviewRating.trim(),
			reviews: reviewCount,
			address: address === undefined ? '' : address.trim(),
			website: website === undefined ? '' : website.trim(),
			phone: phone === undefined ? '' : phone.trim().replace(/\-/g, ''),
			latitude: latLong[0],
			longitude: latLong[1],
			main_image: images[0],
			all_images: images,
			all_reviews: allReviews,
			workHours: workHours
		};

		console.log(returnObj);
	} catch (exception) {
		console.log(exception);
	}

	return returnObj;
}

const getImages = async page => {
	await page.waitForSelector('button[jsaction="pane.heroHeaderImage.click"]');
	await page.click('button[jsaction="pane.heroHeaderImage.click"]');
	await page.waitForNavigation({ waitUntil: "networkidle0" });

	let newScrollHeight = 0;
	let scrollHeight = _puppeteerConfig['height'] - 200;
	// let divSelector = "#pane > div > div > div > div > div:nth-child(4) > div";
	let divSelector = '#pane .siAUzd-neVct.section-scrollbox.cYB2Ge-oHo7ed.cYB2Ge-ti6hGc';

	while (true) {
		await page.waitForSelector(divSelector);

		await page.evaluate((scrollHeight, divSelector) => document.querySelector(divSelector).scrollTo(0, scrollHeight), scrollHeight, divSelector);

		await page.waitForTimeout(800);

		newScrollHeight = await page.$eval(divSelector, div => div.scrollHeight);

		if (scrollHeight === newScrollHeight) {
			break;
		} else {
			scrollHeight = newScrollHeight;
		}
	}

	const images = await page.$$eval('a[data-photo-index] div.loaded', divs => {
		return Array.from(divs).map(div => getComputedStyle(div).backgroundImage.replace('url(', '').replace(')', '').replace('"', ''));
	});

	console.log("Images: ", images);

	await page.waitForTimeout(2000);
	await page.click('button[jsaction="pane.topappbar.back;focus:pane.focusTooltip;blur:pane.blurTooltip"]');
	await page.waitForNavigation({ waitUntil: "networkidle0" });

	return images;
};

const getReviews = async page => {
	try {
		const btnTriggerSelector = 'button[jsaction="pane.rating.moreReviews"]';

		await page.waitForSelector(btnTriggerSelector, { timeout: 5000 });
		await page.click(btnTriggerSelector);
		await page.waitForNavigation({ waitUntil: "networkidle0" });

		let newScrollHeight = 0;
		let scrollHeight = _puppeteerConfig['height'] - 200;
		// let divSelector = "#pane > div > div > div > div > div:nth-child(4) > div";
		let divSelector = '#pane .siAUzd-neVct.section-scrollbox.cYB2Ge-oHo7ed.cYB2Ge-ti6hGc';

		while (true) {
			await page.waitForSelector(divSelector, { timeout: 4000 });

			await page.evaluate((scrollHeight, divSelector) => document.querySelector(divSelector).scrollTo(0, scrollHeight), scrollHeight, divSelector);

			await page.waitForTimeout(1000);

			newScrollHeight = await page.$eval(divSelector, div => div.scrollHeight);

			if (scrollHeight === newScrollHeight) {
				break;
			} else {
				scrollHeight = newScrollHeight;
			}
		}

		const reviews = await page.$$eval('div.ODSEW-ShBeI-content', divs => Array.from(divs).map(div => {
			return {
				author: div.querySelector('.ODSEW-ShBeI-content .ODSEW-ShBeI-title span').innerText.trim(),
				avatar: div.querySelector('.ODSEW-ShBeI-content a[target^="_blank"] img').getAttribute('src').trim(),
				rating: div.querySelector('.ODSEW-ShBeI-content span.ODSEW-ShBeI-H1e3jb').getAttribute('aria-label').replace('stars').replace('bintang').trim(),
				date: div.querySelector('.ODSEW-ShBeI-content span.ODSEW-ShBeI-RgZmSc-date').innerText.trim(),
				text: div.querySelector('.ODSEW-ShBeI-content .ODSEW-ShBeI-text').innerText.trim()
			};
		}));

		console.log((0, _moment2.default)((0, _date2.default)('a year ago')).format('YYYY-mm-dd HH:MM:SS'));

		await page.waitForTimeout(2000);
		await page.click('button.VfPpkd-icon-LgbsSe.yHy1rc.eT1oJ');
		await page.waitForNavigation({ waitUntil: "networkidle0" });

		return reviews;
	} catch (ex) {
		console.error("No reviews found.");
		return [];
	}
};

const getWorkHours = async page => {
	try {
		const tableSelector = 'table.y0skZc-jyrRxf-Tydcue.NVpwyf-qJTHM-ibL1re';

		await page.waitForSelector(tableSelector, { timeout: 5000 });

		const workHours = await page.$$eval(`${tableSelector} tr`, divs => Array.from(divs).map(div => {
			return {
				[div.querySelector('td:nth-child(1)').innerText.trim()]: div.querySelector('td:nth-child(2) ul').innerText.trim()
			};
		}));

		return workHours;
	} catch (ex) {
		console.error("No work hours found.");

		return [];
	}
};

//Get Links
const getLinks = async page => {
	// Scrolling to bottom of page
	let newScrollHeight = 0;
	let scrollHeight = _puppeteerConfig['height'];
	let divSelector = '#pane > div > div > div > div > div > div[role="region"]:nth-child(1)';

	while (true) {
		await page.waitForSelector(divSelector);

		await page.evaluate((scrollHeight, divSelector) => document.querySelector(divSelector).scrollTo(0, scrollHeight), scrollHeight, divSelector);

		await page.waitForTimeout(1000);

		newScrollHeight = await page.$eval(divSelector, div => div.scrollHeight);

		if (scrollHeight === newScrollHeight) {
			break;
		} else {
			scrollHeight = newScrollHeight;
		}
	}

	// Get results
	const searchResults = await page.evaluate(() => Array.from(document.querySelectorAll("a")).map(el => el.href).filter(link => link.match(/https:\/\/www.google.com\/maps\//g, link) && !link.match(/\=https:\/\/www.google.com\/maps\//g, link)));

	return searchResults;
};

async function getLatLong(url) {
	const latLongStartIndex = url.indexOf('!3d-') + 4;
	const latLongEndIndex = url.indexOf('?');
	const latLongData = url.substring(latLongStartIndex, latLongEndIndex).replace('!4d', ':');

	return latLongData.split(":");
}

async function GMapScrapper(searchQuery = "", maxLinks = 100) {
	console.log(`Start scrapping data with query "${searchQuery}"`);

	// Make sure this variable empty
	scrapedData = [];

	const page = await _puppeteerWrapper.newPage();

	const gmapInitUrl = "https://www.google.com/maps?t=" + Date.now();

	page.on('response', response => {
		const status = response.status();
		if (status >= 300 && status <= 399) {
			console.log('Redirect from', response.url(), 'to', response.headers()['location']);
		}
	});

	try {
		await page.goto(gmapInitUrl, { waitUntil: 'networkidle0' });
	} catch (ex) {
		console.log(ex);
		await page.waitForTimeout(800);
		await page.reload({ waitUntil: ["networkidle0", "domcontentloaded"] });
	}

	await page.waitForNavigation({ waitUntil: "domcontentloaded" });
	await page.waitForSelector('div#gs_lc50 input#searchboxinput');

	await page.type('div#gs_lc50 input#searchboxinput', searchQuery, { delay: 10 });
	await page.keyboard.press('Enter');

	let allLinks = [];
	let linkCount = 0;

	while (!(await page.$$eval("#pane > div > div > div > div > div > div > div", elements => Array.from(elements).some(el => el.innerText === "Tidak ditemukan hasil" || el.innerText === "No results found")))) {
		if (maxLinks !== 0 && linkCount > maxLinks) break;

		allLinks.push(...(await getLinks(page)));

		await page.$$eval("button", elements => {
			return Array.from(elements).find(el => el.getAttribute("jsaction") === "pane.paginationSection.nextPage" || el.getAttribute("aria-label") === "Next page").click();
		});

		try {
			await page.waitForNavigation({ waitUntil: "load", timeout: 3000 });
		} catch (ex) {
			break;
		}
	}

	console.log("Validating results...");

	console.log("All Links ", allLinks.length);

	let uniqueLinks = allLinks.filter(function (value, index, self) {
		return self.indexOf(value) === index;
	});

	if (maxLinks > 0) {
		uniqueLinks = uniqueLinks.slice(0, maxLinks);
	}

	await (0, _delay2.default)(2000);

	console.log("Filtered Links ", uniqueLinks.length);

	let no = 1;
	let successCount = 0;
	let failedCount = 0;
	for (let link of uniqueLinks) {
		if (maxLinks !== 0 && no > maxLinks) break;

		console.log('#' + no + ' Processing: "' + link + '...');

		try {
			const data = await getPageData(link, page);

			if (no === 1) (0, _jquery2.default)('#resultsTable tbody').empty();

			console.log("Scraped data: ", data);

			scrapedData.push(data);

			no++;
			successCount++;
		} catch (ex) {
			failedCount++;
			continue;
		}

		await _delay2.default.range(100, 1000);
	}

	await _puppeteerWrapper.cleanup();

	const doneMessage = `Proses scraping dengan kata kunci "${searchQuery}" telah selesai dengan statistik berikut: ${successCount} berhasil, ${failedCount} gagal`;

	console.log(doneMessage);
}

(async () => {
	try {
		const chromeSet = await _puppeteerWrapper.setup();
		if (!chromeSet) {
			console.error("Chrome not found!");
		} else {
			console.log(_puppeteerWrapper._getSavedPath());
		}

		await main();
	} catch (e) {
		_logger.logError('Thrown error:');
		_logger.logError(e);
	} finally {
		await _puppeteerWrapper.cleanup();
	}

	console.log('Done. Close window to exit');

	await _logger.exportLogs(_filePaths.logsPath());
})();

//#endregion
//# sourceMappingURL=cli.js.map