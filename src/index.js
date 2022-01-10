//#region Imports
// Library ----------------------------------------------------------------------------------
import electron from 'electron';
import { Logger } from './lib/logger';
import { FilePaths } from './lib/file-paths.js';
import { PuppeteerWrapper } from './lib/puppeteer-wrapper';
import { CSS_SELECTOR as cssSelector } from './config';
import $ from 'jquery';
import JSONdb from 'simple-json-db';
import axios from 'axios';
import delay from 'delay';
import os from 'os';
import md5 from 'md5';
import datejs from 'date.js';
import moment from 'moment';
//#endregion

//#region Setup - Dependency Injection-----------------------------------------------
const _setting = new JSONdb('./settings.json');
const _logger = new Logger();
const _filePaths = new FilePaths(_logger, "gmap-scrapper");
const _ipcRenderer = electron.ipcRenderer;
const _puppeteerConfig = { headless: false, width: 900, height: 650, args: ['--lang=en-EN,en'] };
const _puppeteerWrapper = new PuppeteerWrapper(_logger, _filePaths, _puppeteerConfig);
let scrapedData = [];
//#endregion

//#region Main ---------------------------------------------------------------------

async function main() {
	await setPlatformText();

	$('#licenseToText').text(_setting.get('user_email'));

	$('#searchBtn').on('click', async (e) => {
		e.preventDefault();

		console.log('Mulai');

		$('table tbody').html('<tr><td class="text-center" colspan="9">Hasil pencarian kosong</td></tr>');
		$('#statusTxt').removeClass('text-danger').removeClass('text-warning').addClass('text-success').text('Ready');
		$('#resultCountText').text('0');

		const searchQuery = $('input#searchBusiness').val();
		const searchLimit = parseInt($('select#searchLimit').val());

		if (searchQuery == "") {
			_ipcRenderer.send('empty-search-query', 'Kata kunci pencarian kosong.');
			return;
		}

		$('input#searchBusiness').attr('disabled', 'disabled');
		$('input#searchLimit').attr('disabled', 'disabled');

		await GMapScrapper(searchQuery, searchLimit);
	});

	$('#stopBtn').on('click', async (e) => {
		e.preventDefault();

		await _puppeteerWrapper.cleanup();

		$('#searchBtn').removeAttr('disabled');
		$(e.target).attr('disabled', 'disabled');
		$('#restartBtn').attr('disabled', 'disabled');

		$('input#searchBusiness').removeAttr('disabled');
		$('input#searchLimit').removeAttr('disabled');
	});

	$('#restartBtn').on('click', async (e) => {
		e.preventDefault();

		$('table tbody').html('<tr><td class="text-center" colspan="9">Hasil pencarian kosong</td></tr>');
		$('#statusTxt').removeClass('text-danger').removeClass('text-warning').addClass('text-success').text('Ready');
		$('#resultCountText').text('0');

		await _puppeteerWrapper.cleanup();

		const searchQuery = $('input#searchBusiness').val();
		const searchLimit = parseInt($('select#searchLimit').val());

		if (searchQuery == "") {
			_ipcRenderer.send('empty-search-query', 'Kata kunci pencarian kosong.');
			return;
		}

		await GMapScrapper(searchQuery, searchLimit);
	});

	$('#exportBtn').on('click', async (e) => {
		_ipcRenderer.send('export-to-xlsx', scrapedData);
	});

	$('#clearBtn').on('click', async (e) => {
		$('table tbody').html('<tr><td class="text-center" colspan="9">Hasil pencarian kosong</td></tr>');
		$('#statusTxt').removeClass('text-danger').removeClass('text-warning').addClass('text-success').text('Ready');
		$('#resultCountText').text('0');

		await loadWebViewPage("https://www.google.com/maps/");
	});

	$('#licenseForm').on('submit', async (e) => {
		e.preventDefault();

		const email = $('#emailAddress').val();
		const key = $('#licenseKey').val();

		validateLicense(email, key);
	});
}

async function setPlatformText() {
	$('#systemInfo').text(os.type() + " " + " " + os.platform() + " " + " " + os.arch() + " " + os.release() + " / Mac Address " + await getMacAddress());
}

async function getMacAddress() {
	const interfaces = os.networkInterfaces();
	let macAddress = '00:00:00:00:00';

	console.log(interfaces);

	for (const key in interfaces) {
		if (interfaces.hasOwnProperty('Wi-Fi') ||
			interfaces.hasOwnProperty('en1') ||
			interfaces.hasOwnProperty('wlan0')) {
			const wirelessNetwork = interfaces['Wi-Fi'] || interfaces['en1'] || interfaces['wlan0'];
			wirelessNetwork.forEach(ifcs => {
				if (ifcs.hasOwnProperty('mac'))
					macAddress = ifcs['mac'];
			});
		}
	}

	return macAddress.toUpperCase();
}

async function validateLicense(email, licenseKey) {
	let signature = _setting.get('signature');

	if (signature == undefined || signature == '') {
		console.log('Generate a new signature hash.');

		const signatureParams = os.hostname() + "-" + getMacAddress();
		const signatureHash = md5(signatureParams);

		_setting.set('signature', signatureHash);

		signature = signatureHash;
	}

	const baseUrl = _setting.get("license_server_url") || 'https://license.pirantisofthouse.com';
	const licenseServerUrl = `${baseUrl}/license-key/get?email=${email}&key=${licenseKey}&signature_hash=${signature}`;

	try {
		const response = await axios.get(licenseServerUrl);
		const licenseData = response.data;
		const status = licenseData.status;

		_setting.set('user_email', email);
		_setting.set('user_license', licenseKey);

		if (status === 1)
			_ipcRenderer.send('license-updated', "success");
		else
			_ipcRenderer.send('license-updated', "failed");
	} catch (ex) {
		console.log(ex);
	}
}

async function getPageData(url, page) {
	console.log(`Processing ${url}...`);

	await page.goto(url);

	//await loadWebViewPage(url);

	//Shop Name
	await page.waitForSelector(".x3AX1-LfntMc-header-title-title span");
	const shopName = await page.$eval(
		cssSelector['shop_name'],
		(name) => name.textContent
	);

	await page.waitForSelector(".x3AX1-LfntMc-header-title-ij8cu-haAclf");
	const reviewRating = await page.$eval(
		cssSelector['rating'],
		(rating) => rating.textContent
	);

	let reviewCount = 0;
	try {
		await page.waitForSelector(".h0ySl-wcwwM-E70qVe-list");
		reviewCount = parseInt(await page.$eval(
			cssSelector['reviews'],
			(review) => review.textContent
		));
	} catch (exception) {
		console.error("No reviews found.");
	}

	//Shop Address
	await page.waitForSelector(".QSFF4-text.gm2-body-2:nth-child(1)");
	let address = await page.$$eval(
		cssSelector['address'],
		(divs) =>
			Array.from(divs)
				.map((div) => div.innerText)
				.find((address) => address)
	);

	if (address === undefined) {
		address = await page.$$eval(
			cssSelector['address_backup'],
			(divs) => divs[1]
		);
	}

	//Website
	try {
		await page.waitForSelector(cssSelector['website'], { timeout: 3 });
	} catch (ex) {
		console.log('No element found.');
	}

	const website = await page.$$eval(
		cssSelector['website'],
		(divs) =>
			Array.from(divs)
				.map((div) => div.innerText)
				.find((link) =>
					/^((https?|ftp|smtp):\/\/)?(www.)?[a-z0-9]+(\.[a-z]{2,}){1,3}(#?\/?[a-zA-Z0-9#]+)*\/?(\?[a-zA-Z0-9-_]+=[a-zA-Z0-9-%]+&?)?$/.test(
						link
					)
				)
	);

	console.log(website || 'No website');

	const phone = await page.$$eval(
		cssSelector['phone'],
		(divs) =>
			Array.from(divs)
				.map((div) => div.innerText)
				.find((phone) => phone)
	);

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
			workHours: workHours,
		};

		console.log(returnObj);
	} catch (exception) {
		console.log(exception);
	}

	return returnObj;
	//await browser.close();
}

const getImages = async (page) => {
	await page.waitForSelector('button[jsaction="pane.heroHeaderImage.click"]');
	await page.click('button[jsaction="pane.heroHeaderImage.click"]');
	await page.waitForNavigation({ waitUntil: "networkidle0" });

	let newScrollHeight = 0;
	let scrollHeight = _puppeteerConfig['height'] - 200;
	// let divSelector = "#pane > div > div > div > div > div:nth-child(4) > div";
	let divSelector = '#pane .siAUzd-neVct.section-scrollbox.cYB2Ge-oHo7ed.cYB2Ge-ti6hGc';

	while (true) {
		await page.waitForSelector(divSelector);

		await page.evaluate(
			(scrollHeight, divSelector) =>
				document.querySelector(divSelector).scrollTo(0, scrollHeight),
			scrollHeight,
			divSelector
		);

		await page.waitForTimeout(800);

		newScrollHeight = await page.$eval(
			divSelector,
			(div) => div.scrollHeight
		);

		if (scrollHeight === newScrollHeight) {
			break;
		} else {
			scrollHeight = newScrollHeight;
		}
	}

	const images = await page.$$eval(
		'a[data-photo-index] div.loaded',
		(divs) => {
			return Array.from(divs)
				.map((div) => getComputedStyle(div).backgroundImage.replace('url(', '').replace(')', '').replace('"', ''));
		}
	);

	console.log("Images: ", images);

	await page.waitForTimeout(2000);
	await page.click('button[jsaction="pane.topappbar.back;focus:pane.focusTooltip;blur:pane.blurTooltip"]');
	await page.waitForNavigation({ waitUntil: "networkidle0" });

	return images;
}

const getReviews = async (page) => {
	try {
		const btnTriggerSelector = 'button[jsaction="pane.rating.moreReviews"]';

		await page.waitForSelector(btnTriggerSelector, {timeout: 5000});
		await page.click(btnTriggerSelector);
		await page.waitForNavigation({ waitUntil: "networkidle0" });

		let newScrollHeight = 0;
		let scrollHeight = _puppeteerConfig['height'] - 200;
		// let divSelector = "#pane > div > div > div > div > div:nth-child(4) > div";
		let divSelector = '#pane .siAUzd-neVct.section-scrollbox.cYB2Ge-oHo7ed.cYB2Ge-ti6hGc';

		while (true) {
			await page.waitForSelector(divSelector, { timeout: 4000 });

			await page.evaluate(
				(scrollHeight, divSelector) =>
					document.querySelector(divSelector).scrollTo(0, scrollHeight),
				scrollHeight,
				divSelector
			);

			await page.waitForTimeout(1000);

			newScrollHeight = await page.$eval(
				divSelector,
				(div) => div.scrollHeight
			);

			if (scrollHeight === newScrollHeight) {
				break;
			} else {
				scrollHeight = newScrollHeight;
			}
		}

		const reviews = await page.$$eval(
			'div.ODSEW-ShBeI-content',
			(divs) => Array.from(divs)
				.map((div) => {
					return {
						author: div.querySelector('.ODSEW-ShBeI-content .ODSEW-ShBeI-title span').innerText.trim(),
						avatar: div.querySelector('.ODSEW-ShBeI-content a[target^="_blank"] img').getAttribute('src').trim(),
						rating: div.querySelector('.ODSEW-ShBeI-content span.ODSEW-ShBeI-H1e3jb').getAttribute('aria-label').replace('stars').replace('bintang').trim(),
						date: div.querySelector('.ODSEW-ShBeI-content span.ODSEW-ShBeI-RgZmSc-date').innerText.trim(),
						text: div.querySelector('.ODSEW-ShBeI-content .ODSEW-ShBeI-text').innerText.trim(),
					};
				})
		);

		console.log(moment(datejs('a year ago')).format('YYYY-mm-dd HH:MM:SS'));

		await page.waitForTimeout(2000);
		await page.click('button.VfPpkd-icon-LgbsSe.yHy1rc.eT1oJ');
		await page.waitForNavigation({ waitUntil: "networkidle0" });

		return reviews;
	} catch (ex) {
		console.error("No reviews found.");
		return [];
	}
}

const getWorkHours = async (page) => {
	try {
		const tableSelector = 'table.y0skZc-jyrRxf-Tydcue.NVpwyf-qJTHM-ibL1re';

		await page.waitForSelector(tableSelector, {timeout: 5000});

		const workHours = await page.$$eval(
			`${tableSelector} tr`,
			(divs) => Array.from(divs)
				.map((div) => {
					return {
						[div.querySelector('td:nth-child(1)').innerText.trim()]: div.querySelector('td:nth-child(2) ul').innerText.trim(),
					};
				})
		);

		return workHours;
	} catch (ex) {
		console.error("No work hours found.");

		return [];
	}
}

//Get Links
const getLinks = async (page) => {
	// Scrolling to bottom of page
	let newScrollHeight = 0;
	let scrollHeight = _puppeteerConfig['height'];
	let divSelector = '#pane > div > div > div > div > div > div[role="region"]:nth-child(1)';

	while (true) {
		await page.waitForSelector(divSelector);

		await page.evaluate(
			(scrollHeight, divSelector) =>
				document.querySelector(divSelector).scrollTo(0, scrollHeight),
			scrollHeight,
			divSelector
		);

		await page.waitForTimeout(1000);

		newScrollHeight = await page.$eval(
			divSelector,
			(div) => div.scrollHeight
		);

		if (scrollHeight === newScrollHeight) {
			break;
		} else {
			scrollHeight = newScrollHeight;
		}
	}

	// Get results
	const searchResults = await page.evaluate(() =>
		Array.from(document.querySelectorAll("a"))
			.map((el) => el.href)
			.filter(
				(link) =>
					link.match(/https:\/\/www.google.com\/maps\//g, link) &&
					!link.match(/\=https:\/\/www.google.com\/maps\//g, link)
			)
	);

	return searchResults;
}

async function getLatLong(url) {
	const latLongStartIndex = url.indexOf('!3d-') + 4;
	const latLongEndIndex = url.indexOf('?');
	const latLongData = url.substring(latLongStartIndex, latLongEndIndex).replace('!4d', ':');

	return latLongData.split(":");
}

async function loadWebViewPage(url) {
	const webview = document.getElementById('gmapWv');
	await webview.loadURL(url);

	webview.removeEventListener('dom-ready', loadWebViewPage);
	webview.addEventListener('dom-ready', loadWebViewPage);
}

async function GMapScrapper(searchQuery = "", maxLinks = 100) {
	console.log('Start scrapping data.');

	// Make sure this variable empty
	scrapedData = [];

	$('#searchBtn').attr('disabled', 'disabled');
	$('#stopBtn').removeAttr('disabled');
	$('#restartBtn').removeAttr('disabled');
	$('span#statusTxt').removeClass('text-success').addClass('text-danger').html('<img src="res/images/loader.gif" width="20" height="20"> Mulai scraping listing...');

	const page = await _puppeteerWrapper.newPage();

	const gmapInitUrl = "https://www.google.com/maps?t=" + Date.now(); // + searchQuery.replace(/\s/g, '+');

	await loadWebViewPage(gmapInitUrl + "?q=" + searchQuery.replace(/\s/g, '+'));

	page.on('response', response => {
		const status = response.status();
		console.log(status)
		if ((status >= 300) && (status <= 399)) {
			console.log('Redirect from', response.url(), 'to', response.headers()['location'])
		}
	})

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

	while (
		!(await page.$$eval(
			"#pane > div > div > div > div > div > div > div",
			(elements) =>
				Array.from(elements).some(
					(el) => (el.innerText === "Tidak ditemukan hasil" || el.innerText === "No results found")
				)
		))
	) {
		if (maxLinks !== 0 && linkCount > maxLinks) break;

		allLinks.push(...(await getLinks(page)));

		await page.$$eval("button", (elements) => {
			return Array.from(elements)
				.find((el) => (el.getAttribute("jsaction") === "pane.paginationSection.nextPage" || el.getAttribute("aria-label") === "Next page"))
				.click()
		});

		try {
			await page.waitForNavigation({ waitUntil: "load", timeout: 3000 });
		} catch (ex) {
			break;
		}

		linkCount = allLinks.length;

		$('span#statusTxt').removeClass('text-danger').addClass('text-warning').html('<img src="res/images/loader.gif" width="20" height="20"> Mengumpulkan listing...');

		if (maxLinks == 0) {
			$('#resultCountText').text(linkCount);
		} else {
			$('#resultCountText').text(linkCount > maxLinks ? maxLinks : linkCount);
		}
	}

	$('#resultsTable tbody').html('<tr><td class="text-center" colspan="9"><p class="m-0 p-0"><img src="res/images/loader.gif" width="20" height="20"> Sedang melakukan validasi listing yang didapat...</p></td></tr>');

	console.log("All Links ", allLinks.length);

	let uniqueLinks = allLinks.filter(function (value, index, self) {
		return self.indexOf(value) === index;
	});

	if (maxLinks > 0) {
		uniqueLinks = uniqueLinks.slice(0, maxLinks);
	}

	$('span#statusTxt').removeClass('text-warning').addClass('text-success').html('<img src="res/images/loader.gif" width="20" height="20"> Validasi listing...');

	await delay(2000);

	console.log("Filtered Links ", uniqueLinks.length);

	$('#resultCountText').text(uniqueLinks.length);

	let no = 1;
	let successCount = 0;
	let failedCount = 0;
	for (let link of uniqueLinks) {
		if (maxLinks !== 0 && no > maxLinks) break;

		$('span#statusTxt').removeClass('text-warning').addClass('text-success').html('<img src="res/images/loader.gif" width="20" height="20"> #' + no + ' Memproses "' + link + '"');

		try {
			const data = await getPageData(link, page);
			if (no === 1) $('#resultsTable tbody').empty();

			$('#resultsTable tbody').append(`
				<tr>
					<th scope="row">${no}</th>
					<td>${data.shop}</td>
					<td>${data.address}</td>
					<td>${data.phone}</td>
					<td>${data.website}</td>
					<td>${data.rating}</td>
					<td>${data.reviews}</td>
					<td>${data.latitude}</td>
					<td>${data.longitude}</td>
				</tr>
			`);
			scrapedData.push(data);
			no++;
			successCount++;
		} catch (ex) {
			failedCount++;
			continue;
		}

		await delay.range(100, 1000);
	}

	$('#searchBtn').removeAttr('disabled');
	$('#stopBtn').attr('disabled', 'disabled');
	$('#restartBtn').attr('disabled', 'disabled');

	$('input#searchBusiness').removeAttr('disabled');
	$('input#searchLimit').removeAttr('disabled');

	await _puppeteerWrapper.cleanup();

	const doneMessage = `Proses scraping dengan kata kunci "${searchQuery}" telah selesai dengan statistik berikut: ${successCount} berhasil, ${failedCount} gagal`;

	$('span#statusTxt').removeClass('text-danger').addClass('text-success').text(doneMessage);

	_ipcRenderer.send('scraping-done', doneMessage);
}

_ipcRenderer.on('chrome-path-is-set', (event, arg) => {
	$('span#chromeInfo').addClass('text-success').text(arg);
});

(async () => {
	try {
		const chromeSet = await _puppeteerWrapper.setup();
		if (!chromeSet) {
			_ipcRenderer.send('chrome-not-found');
		} else {
			$('span#chromeInfo').addClass('text-success').text(_puppeteerWrapper._getSavedPath());
		}

		await main();
	} catch (e) {
		_logger.logError('Thrown error:');
		_logger.logError(e);
	} finally {
		await _puppeteerWrapper.cleanup();
	}

	_logger.logInfo('Done. Close window to exit');

	await _logger.exportLogs(_filePaths.logsPath());
})();

//#endregion
