//#region Imports
// Library ----------------------------------------------------------------------------------
import { Logger } from './lib/logger';
import { FilePaths } from './lib/file-paths.js';
import { PuppeteerWrapper } from './lib/puppeteer-wrapper';
import { CSS_SELECTOR as cssSelector } from './config';
import Model from './lib/model';
import $ from 'jquery';
import delay from 'delay';
import datejs from 'date.js';
import moment from 'moment';
//#endregion

//#region Setup - Dependency Injection-----------------------------------------------
const _logger = new Logger();
const _filePaths = new FilePaths(_logger, "gmap-scrapper");
const _puppeteerConfig = { headless: false, width: 1326, height: 900, args: ['--lang=en-EN,en'] };
const _puppeteerWrapper = new PuppeteerWrapper(_logger, _filePaths, _puppeteerConfig);
//#endregion

const getReviews = async (page) => {
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

			const buttons = await page.$x('//button[@jsaction="pane.review.expandReview"]');
			for (let button of buttons) {
				await button.click();
				await delay.range(500, 3000);
			}
			await delay.range(100, 3500);
		}

		const reviews = await page.$$eval(
			'div.ODSEW-ShBeI-content',
			(divs) => Array.from(divs)
				.map((div) => {
					const replaceString = {
						"setahun": "a year",
						"sebulan": "a month",
						"seminggu": "a week",
						"sehari": "a day",
						"sejam": "an hour",
						"semenit": "a minute",
						"tahun": "years",
						"bulan": "months",
						"minggu": "weeks",
						"hari": "days",
						"jam": "hours",
						"menit": "minutes",
						"lalu": "ago"
					};
					let dateInEnglish = div.querySelector('.ODSEW-ShBeI-content span.ODSEW-ShBeI-RgZmSc-date').innerText.trim();

					for (const key in replaceString) {
						if (Object.hasOwnProperty.call(replaceString, key)) {
							const replacement = replaceString[key];
							dateInEnglish = dateInEnglish.replace(key, replacement);
						}
					}

					const reviewText = div.querySelector('.ODSEW-ShBeI-content .ODSEW-ShBeI-text').innerText.trim();
					const startTrimIndex = reviewText.indexOf('(Translated by Google)') + 22;
					const endTrimIndex = reviewText.indexOf('(Original)');
					const cleanedReviewText = reviewText.substring(startTrimIndex, endTrimIndex).trim();

					return {
						author: div.querySelector('.ODSEW-ShBeI-content .ODSEW-ShBeI-title span').innerText.trim(),
						title: div.querySelector('.ODSEW-ShBeI-content .ODSEW-ShBeI-title span').innerText.trim(),
						avatar: div.querySelector('.ODSEW-ShBeI-content a[target^="_blank"] img').getAttribute('src').trim(),
						rating: div.querySelector('.ODSEW-ShBeI-content span.ODSEW-ShBeI-H1e3jb').getAttribute('aria-label').replace('stars', '').replace('bintang', '').trim(),
						text: reviewText.indexOf('(Translated by Google)') === -1 ? reviewText.trim() : cleanedReviewText,
						length: parseInt(reviewText.indexOf('(Translated by Google)') === -1 ? reviewText.trim().length : cleanedReviewText.length),
						date: dateInEnglish,
					};
				})
		);

		console.log("Reviews before validation: ", reviews);

		const reviewData = [];

		for (let i = 0; i < reviews.length; i++) {
			const review = reviews[i];
			console.log(review['length']);
			if (reviews['length'] >= 100) {
				review['date'] = moment(datejs(review['date'])).format('YYYY-MM-DD HH:mm:ss').toString();
				reviewData.push(review);
			}
		}

		await page.waitForTimeout(300);
		await page.goBack({ timeout: 3000, waitUntil: 'networkidle0' });
		// await page.click('button[aria-label="Back"].eT1oJ');
		// await page.waitForNavigation({ waitUntil: "networkidle0" });

		return reviewData;
	} catch (ex) {
		console.log("No reviews found.");
		console.error(ex);
		return [];
	}
}

const main = async () => {
	const gmapInitUrl = "https://www.google.com/maps/place/Finnkino+Omena/@60.1617588,24.7028655,13z/data=!4m11!1m2!2m1!1smovie+theater+in+Espoo,+Finland!3m7!1s0x468df51d7e7e3db9:0x8fdbdef4eace3a0d!8m2!3d60.1617588!4d24.7378844!9m1!1b1!15sCh9tb3ZpZSB0aGVhdGVyIGluIEVzcG9vLCBGaW5sYW5kkgENbW92aWVfdGhlYXRlcg?authuser=0";

	const page = await _puppeteerWrapper.newPage();
	// page.on('response', response => {
	// 	const status = response.status();
	// 	if ((status >= 300) && (status <= 399)) {
	// 		console.log('Redirect from', response.url(), 'to', response.headers()['location'])
	// 	}
	// });

	page.on('dialog', async dialog => {
		await delay(1000);
		await dialog.accept();
	});

	try {
		await page.goto(gmapInitUrl, { waitUntil: 'networkidle0' });
	} catch (ex) {
		console.log(ex);
		await page.waitForTimeout(800);
		await page.reload({ waitUntil: ["networkidle0", "domcontentloaded"] });
	}

	await page.waitForNavigation({ waitUntil: "domcontentloaded" });

	const reviews = await getReviews(page);

	console.log(reviews);
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
		console.log('Done. Close application process.');
	}

	await _logger.exportLogs(_filePaths.logsPath());
})();
