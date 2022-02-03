import { Logger } from './lib/logger';
import { FilePaths } from './lib/file-paths.js';
import { PuppeteerWrapper } from './lib/puppeteer-wrapper';
import { CSS_SELECTOR as cssSelector } from './config';
import delay from 'delay';
import yargs from 'yargs';

const _logger = new Logger();
const _filePaths = new FilePaths(_logger, "gmap-scrapper");
const _puppeteerConfig = { headless: false, width: 1300, height: 780, args: ['--lang=en-EN,en'] };
const _puppeteerWrapper = new PuppeteerWrapper(_logger, _filePaths, _puppeteerConfig);
const _args = yargs.argv;

const changeLocation = async (countryCode, page) => {
	console.log("Change location to Finland.");

	const locationMenuSelector = 'button[jsaction="fineprint.country"]';

	await page.waitForSelector(locationMenuSelector);
	await page.click(locationMenuSelector);

	const moreRegionLinkSelector = 'a#regionanchormore';
	await page.waitForSelector(moreRegionLinkSelector, { waitUntil: 'networkidle2' });
	await page.waitForTimeout(400);
	await page.click(moreRegionLinkSelector);

	await page.waitForSelector('#regionother');

	await page.waitForTimeout(100);

	await page.click(`div[data-value="${countryCode}"`);
	await page.waitForTimeout(500);
	await page.click('div.jfk-button:nth-child(1)');
}

const changeLanguage = async (page) => {
	console.log('Change language to English.');

	const locationMenuSelector = 'button[jsaction="fineprint.country"]';

	await page.waitForSelector(locationMenuSelector);
	await page.click(locationMenuSelector);

	await page.waitForTimeout(300);

	await page.waitForSelector('a[aria-controls="langSec"]');
	await page.click('a[aria-controls="langSec"]');

	await page.waitForTimeout(400);

	await page.waitForSelector('a#langanchormore');
	await page.click(`div[data-value="en"`);

	await page.waitForTimeout(200);

	await page.click('div.jfk-button:nth-child(1)');
}

const getReviews = async (page, url) => {
	const reviewData = [];

	try {
		const btnTriggerSelector = 'button[jsaction="pane.rating.moreReviews"]';

		await page.waitForSelector(btnTriggerSelector, { timeout: 1000 });
		await page.click(btnTriggerSelector);
		await page.waitForNavigation({ waitUntil: "networkidle0" });

		let newScrollHeight = 0;
		let scrollHeight = _puppeteerConfig['height'] - 200;
		// let divSelector = "#pane > div > div > div > div > div:nth-child(4) > div";
		let divSelector = '#pane .siAUzd-neVct.section-scrollbox.cYB2Ge-oHo7ed.cYB2Ge-ti6hGc';

		while (true) {
			await page.waitForSelector(divSelector, { timeout: 1000 });

			await page.evaluate(
				(scrollHeight, divSelector) =>
					document.querySelector(divSelector).scrollTo(0, scrollHeight),
				scrollHeight,
				divSelector
			);

			await page.waitForTimeout(100);

			newScrollHeight = await page.$eval(
				divSelector,
				(div) => div.scrollHeight
			);

			if (scrollHeight === newScrollHeight) {
				break;
			} else {
				scrollHeight = newScrollHeight;
			}

			console.log("Scrolling reviews...");

			const buttons = await page.$x('//button[@jsaction="pane.review.expandReview"]');
			for (let button of buttons) {
				console.log("Click more review button...");

				await button.click();
				await delay.range(100, 300);
			}
			await delay.range(100, 150);
		}

		let reviews = [];
		try {
			reviews = await page.$$eval(
				'div.ODSEW-ShBeI-content',
				(divs) => Array.from(divs)
					.map((div) => {
						const dateText = div.querySelector('.ODSEW-ShBeI-content span.ODSEW-ShBeI-RgZmSc-date').innerText.trim();
						const reviewText = div.querySelector('.ODSEW-ShBeI-content .ODSEW-ShBeI-text').innerText.trim();
						const startTrimIndex = reviewText.indexOf('(Original)') + 10;

						return {
							author: div.querySelector('.ODSEW-ShBeI-content .ODSEW-ShBeI-title span').innerText.trim(),
							title: div.querySelector('.ODSEW-ShBeI-content .ODSEW-ShBeI-title span').innerText.trim(),
							avatar: div.querySelector('.ODSEW-ShBeI-content a[target^="_blank"] img').getAttribute('src').trim(),
							rating: div.querySelector('.ODSEW-ShBeI-content span.ODSEW-ShBeI-H1e3jb').getAttribute('aria-label').replace('stars', '').replace('star', '').replace('bintang', '').trim(),
							text: reviewText.indexOf('(Original)') === -1 ? reviewText.trim() : reviewText.substring(startTrimIndex).trim(),
							length: reviewText.indexOf('(Original)') === -1 ? reviewText.trim().length : reviewText.substring(startTrimIndex).trim().length,
							date: dateText,
						};
					})
			);
		} catch (ex) {
			reviews = await page.$$eval(
				'div.ODSEW-ShBeI-content',
				(divs) => Array.from(divs)
					.map((div) => {
						console.log(div);

						const dateText = div.querySelector('.ODSEW-ShBeI-RgZmSc-date-J42Xof-Hjleke span').innerText.trim();
						const reviewText = div.querySelector('.ODSEW-ShBeI-content .ODSEW-ShBeI-text').innerText.trim();
						const startTrimIndex = reviewText.indexOf('(Original)') + 10;

						return {
							author: div.querySelector('.ODSEW-ShBeI-content .ODSEW-ShBeI-title span').innerText.trim(),
							title: div.querySelector('.ODSEW-ShBeI-content .ODSEW-ShBeI-title span').innerText.trim(),
							avatar: div.querySelector('a.ODSEW-ShBeI-t1uDwd-hSRGPd img').getAttribute('src').trim(),
							rating: div.querySelector('.ODSEW-ShBeI-RGxYjb-wcwwM').innerText().split('/')[0] || 1,
							text: reviewText.indexOf('(Original)') === -1 ? reviewText.trim() : reviewText.substring(startTrimIndex).trim(),
							length: reviewText.indexOf('(Original)') === -1 ? reviewText.trim().length : reviewText.substring(startTrimIndex).trim().length,
							date: dateText,
						};
					})
			);
		}

		console.log("Reviews before validation: ", reviews);

		for (let i = 0; i < reviews.length; i++) {
			const review = reviews[i];
			if (review['length'] >= 60) {
				review['date'] = moment(datejs(review['date'])).format('YYYY-MM-DD HH:mm:ss').toString();
				reviewData.push(review);
			}
		}

		if (reviews.length === 0) {
			saveItemWithoutReviews(url);
		}

		console.log("Reviews after validation: ", reviewData);

		return reviewData;
	} catch (ex) {
		console.log("No reviews found.");
		console.log(ex);
	}

	return reviewData;
}

const getPageData = async (url) => {
	const page = await _puppeteerWrapper.newPage();

	console.log(url.replace(/\\/g, ''));

	page.on('dialog', async dialog => {
		await delay(300);
		await dialog.accept();
	});

	await page.goto("https://google.com/maps");
	await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 });

	await changeLocation("FI", page);
	await changeLanguage(page);
	await page.goto(url.replace(/\\/g, ''));

	//Reviews
	let reviewCount = 0;
	try {
		await page.waitForSelector(".h0ySl-wcwwM-E70qVe-list");
		reviewCount = parseInt(await page.$eval(
			cssSelector['reviews'],
			(review) => review.textContent.replaceAll('reviews', '').trim()
		));
		console.error(`Found ${reviewCount} reviews.`);
	} catch (exception) {
		console.error("No reviews found. Skip.");
	}

	if (reviewCount > 0) {
		let returnObj = {};

		try {
			const allReviews = await getReviews(page, url);

			try {
				await page.goBack({ timeout: 3000, waitUntil: 'networkidle0' });
			} catch (ex) {
				await page.waitForSelector('button.VfPpkd-icon-LgbsSe.yHy1rc.eT1oJ', { timeout: 3000, waitUntil: 'networkidle2' });
				await page.click('button.VfPpkd-icon-LgbsSe.yHy1rc.eT1oJ');
			} finally {
				await page.goto(url, { timeout: 10000 });
			}

			if (allReviews.length == 0) {
				return {};
			}

			await page.waitForNavigation({ waitUntil: "load", timeout: 5000 });

			console.log("Reviews after validation: ", allReviews);

			let placeName = ''
			try {
				//Shop Name
				await page.waitForSelector(".x3AX1-LfntMc-header-title-title span", { timeout: 5000 });
				placeName = await page.$eval(
					cssSelector['shop_name'],
					(name) => name.textContent
				);

			} catch (ex) {
				await page.screenshot({ path: 'screenshots/no-place-name-' + (+new Date) + '.png' });
				console.log("No place name found.");
			}

			let category = ''
			try {
				await page.waitForSelector('button[jsaction="pane.rating.category"]', { timeout: 5000 });
				category = await page.$eval(
					'button[jsaction="pane.rating.category"]',
					(category) => category.textContent
				);
			} catch (ex) {
				console.log("No category name found.");
			}

			let reviewRating = '';
			try {
				await page.waitForSelector(".x3AX1-LfntMc-header-title-ij8cu-haAclf", { timeout: 5000 });
				reviewRating = await page.$eval(
					cssSelector['rating'],
					(rating) => rating.textContent
				);
			} catch (ex) {
				console.log("No review and rating found.");
			}

			//Shop Address
			let address = '';
			let cityName = '';
			try {
				await page.waitForSelector(".QSFF4-text.gm2-body-2:nth-child(1)", { timeout: 5000 });
				address = await page.$$eval(
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

				const addressData = address.split(' ') || [''];
				cityName = typeof address == 'undefined' ? '' : addressData[addressData.length - 1];
			} catch (ex) {
				console.log("No address and city found.");
			}

			let website = '';
			try {
				//Website
				await page.waitForSelector(cssSelector['website'], { timeout: 1000 });

				website = await page.$$eval(
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
			} catch (ex) {
				console.log('No website found');
			}

			let phone = '';
			try {
				phone = await page.$$eval(
					cssSelector['phone'],
					(divs) =>
						Array.from(divs)
							.map((div) => div.innerText)
							.find((phone) => phone)
				);
			} catch (ex) {
				console.log('No phone found.');
			}


			// const latLong = await getLatLong(url);

			// //Hours of works
			// const workHours = await getWorkHours(page);

			// //Images
			// const images = await getImages(page);

			returnObj = {
				placeName: placeName.trim(),
				category: category.trim(),
				rating: typeof reviewRating === 'undefined' ? '' : reviewRating.trim(),
				reviews: reviewCount,
				address: typeof address === 'undefined' ? '' : address.trim(),
				cityName: cityName,
				website: typeof website === 'undefined' ? '' : website.trim(),
				phone: typeof phone === 'undefined' ? '' : phone.trim().replace(/\-/g, ''),
				all_reviews: allReviews,
			};
		} catch (exception) {
			console.error(exception);
		}

		return returnObj;
	} else {
		return {};
	}
}

const main = async () => {
	const url = _args['c'] || '';

	if (url) {
		await getPageData(url);
	}
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

		process.exit(1);
	} finally {
		await _puppeteerWrapper.cleanup();
	}

	console.log('Done. Close application process.');

	// await _logger.exportLogs(_filePaths.logsPath());
})();
