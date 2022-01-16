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
const _puppeteerConfig = { headless: false, width: 900, height: 650, args: ['--lang=en-EN,en'] };
const _puppeteerWrapper = new PuppeteerWrapper(_logger, _filePaths, _puppeteerConfig);
//#endregion

const countryCode = 'FI';

//#region Main ---------------------------------------------------------------------

async function main() {
	const searchLimit = parseInt(process.argv[2] || 0);
	const cities = await Model.CityName.findAll();
	const categories = await Model.CategoryName.findAll();
	const keywords = [];

	cities.forEach(async (city) => {
		categories.forEach(async (category) => {
			const searchQuery = `${category.name} in ${city.name}, Finland`;
			keywords.push({
				query: searchQuery,
				city: city.id,
				category: category.id,
			});
		});
	});

	for (let i = 0; i < keywords.length; i++) {
		const keyword = keywords[i];

		await GMapScrapper(keyword.query, searchLimit, keyword.city, keyword.category);
		await delay.range(1000, 6000);
	}
}

const changeLocation = async (countryCode, page) => {
	const locationMenuSelector = 'button[jsaction="fineprint.country"]';

	await page.waitForSelector(locationMenuSelector);
	await page.click(locationMenuSelector);

	const moreRegionLinkSelector = 'a#regionanchormore';
	await page.waitForSelector(moreRegionLinkSelector, { waitUntil: 'networkidle2' });
	await page.waitForTimeout(1000);
	await page.click(moreRegionLinkSelector);

	await page.waitForSelector('#regionother');

	await page.waitForTimeout(1000);

	await page.click(`div[data-value="${countryCode}"`);
	await page.waitForTimeout(1000);
	await page.click('div.jfk-button:nth-child(1)');
}

const changeLanguage = async (page) => {
	const locationMenuSelector = 'button[jsaction="fineprint.country"]';

	await page.waitForSelector(locationMenuSelector);
	await page.click(locationMenuSelector);

	await page.waitForTimeout(1000);

	await page.waitForSelector('a[aria-controls="langSec"]');
	await page.click('a[aria-controls="langSec"]');

	await page.waitForTimeout(1000);

	await page.waitForSelector('a#langanchormore');
	await page.click(`div[data-value="en"`);

	await page.waitForTimeout(1000);

	await page.click('div.jfk-button:nth-child(1)');
}

async function getPageData(url, page) {
	await page.goto(url);
	await page.waitForNavigation({ timeout: 5000, waitUntil: ['networkidle0'] });

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
			const allReviews = await getReviews(page);

			if (allReviews.length == 0) {
				return {};
			}

			console.log("Reviews after validation: ", allReviews);

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
			await page.waitForSelector(cssSelector['website'], { timeout: 3 });

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

			returnObj = {
				placeName: shopName.trim(),
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
				workHours: JSON.stringify(workHours),
			};
		} catch (exception) {
			console.error(exception);
		}

		return returnObj;
	} else {
		return {};
	}
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
	await page.goBack({ timeout: 3000, waitUntil: "networkidle0" });
	// await page.click('button[jsaction="pane.topappbar.back;focus:pane.focusTooltip;blur:pane.blurTooltip"]');
	// await page.waitForNavigation({ waitUntil: "networkidle0" });

	return images;
}

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
					const startTrimIndex = reviewText.indexOf('(Original)') + 10;

					return {
						author: div.querySelector('.ODSEW-ShBeI-content .ODSEW-ShBeI-title span').innerText.trim(),
						title: div.querySelector('.ODSEW-ShBeI-content .ODSEW-ShBeI-title span').innerText.trim(),
						avatar: div.querySelector('.ODSEW-ShBeI-content a[target^="_blank"] img').getAttribute('src').trim(),
						rating: div.querySelector('.ODSEW-ShBeI-content span.ODSEW-ShBeI-H1e3jb').getAttribute('aria-label').replace('stars', '').replace('bintang', '').trim(),
						text: reviewText.indexOf('(Original)') === -1 ? reviewText.trim() : reviewText.substring(startTrimIndex).trim(),
						length: reviewText.indexOf('(Original)') === -1 ? reviewText.trim().length : reviewText.substring(startTrimIndex).trim().length,
						date: dateInEnglish,
					};
				})
		);

		console.log("Reviews before validation: ", reviews);

		const reviewData = [];

		for (let i = 0; i < reviews.length; i++) {
			const review = reviews[i];
			console.log(review['length'] >= 80);
			if (reviews['length'] >= 80) {
				review['date'] = moment(datejs(review['date'])).format('YYYY-MM-DD HH:mm:ss').toString();
				reviewData.push(review);
			}
		}

		await page.waitForTimeout(300);
		await page.goBack({timeout: 3000, waitUntil: 'networkidle0'});
		// await page.click('button[aria-label="Back"].eT1oJ');
		// await page.waitForNavigation({ waitUntil: "networkidle0" });

		return reviewData;
	} catch (ex) {
		console.log("No reviews found.");
		console.error(ex);
		return [];
	}
}

const getWorkHours = async (page) => {
	try {
		const tableSelector = 'table.y0skZc-jyrRxf-Tydcue.NVpwyf-qJTHM-ibL1re';

		await page.waitForSelector(tableSelector, { timeout: 5000 });

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

const getLatLong = (url) => {
	let latLongStartIndex = url.indexOf('!3d') + 4;
	let latLongEndIndex = url.indexOf('?');
	let latLongData = url.substring(latLongStartIndex, latLongEndIndex).split('!4d');

	if (isNaN(latLongData[0]) || isNaN(latLongData[1])) {
		latLongStartIndex = url.indexOf('/@') + 2;
		latLongEndIndex = url.indexOf(',15z');
		latLongData = url.substring(latLongStartIndex, latLongEndIndex).split(",");
	}

	return latLongData;
}

const slugify = (str) => {
	str = str.replace(/^\s+|\s+$/g, ''); // trim
	str = str.toLowerCase();

	// remove accents, swap ñ for n, etc
	var from = "àáäâèéëêìíïîòóöôùúüûñç·/_,:;";
	var to = "aaaaeeeeiiiioooouuuunc------";
	for (var i = 0, l = from.length; i < l; i++) {
		str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
	}

	str = str.replace(/[^a-z0-9 -]/g, '') // remove invalid chars
		.replace(/\s+/g, '-') // collapse whitespace and replace by -
		.replace(/-+/g, '-'); // collapse dashes

	return str;
}

async function GMapScrapper(searchQuery, maxLinks = 100, city, category) {
	console.log(`Start scrapping data with query "${searchQuery}"`);

	const page = await _puppeteerWrapper.newPage();

	const gmapInitUrl = "https://www.google.com/maps";

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
		await changeLocation(countryCode, page);
		await changeLanguage(page);
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

		console.log(`Links count: ${linkCount}`);
	}

	console.log("Validating results...");

	console.log("All Links ", allLinks.length);

	let uniqueLinks = allLinks.filter(function (value, index, self) {
		return self.indexOf(value) === index;
	});

	if (maxLinks > 0) {
		uniqueLinks = uniqueLinks.slice(0, maxLinks);
	}

	await delay(2000);

	console.log("Filtered Links ", uniqueLinks.length);

	let no = 1;
	let successCount = 0;
	let failedCount = 0;
	for (let link of uniqueLinks) {
		if (maxLinks !== 0 && no > maxLinks) break;

		console.log('#' + no + ' Processing: "' + link + '...');

		try {
			const data = await getPageData(link, page);

			console.log("Data: ", data);

			if (Object.hasOwnProperty.call(data, 'placeName')) {
				const item = await Model.Item.findOne({ where: { name: data.placeName } });
				if (item == null) {
					console.log('Save the items');

					const item = await Model.Item.create({
						name: data.placeName,
						slug: slugify(data.placeName),
						address: data.address,
						latitude: data.latitude,
						longitude: data.longitude,
						address: data.address,
						hours_of_work: data.workHours == '[]' ? '' : data.workHours,
						website: data.website,
						image_remote: data.main_image,
						image: data.main_image,
						phone: data.phone,
						date_created: moment().format('YYYY-MM-DD HH:mm:ss').toString(),
						item_city: city,
						link: link,
					});

					console.log("Item created: ", item);

					await Model.City.create({
						cities_names_id: city,
						items_id: item.id,
					});

					const existingItemCategory = await Model.Category.findOne({ where: { items_id: item.id } });
					if (existingItemCategory == null) {
						await Model.Category.create({
							categories_names_id: category,
							items_id: item.id,
						});
					}

					for (let i = 0; i < data.all_images.length; i++) {
						const imageUrl = data.all_images[i];

						const existingImage = await Model.Image.findOne({ where: { items_id: item.id, url: imageUrl } });
						if (existingImage == null) {
							await Model.Image.create({
								items_id: item.id,
								url: imageUrl,
							});
						}
					}

					for (let i = 0; i < data.all_reviews.length; i++) {
						const review = data.all_reviews[i];

						const existingReview = await Model.Comment.findOne({ where: { items_id: item.id, author: review.author, text: review.text } });
						if (existingReview == null) {
							await Model.Comment.create({
								items_id: item.id,
								title: item.title,
								author: review.author,
								text: review.text,
								rating: review.rating || 0,
								avatar: review.avatar,
								date: review.date,
							});
						}
					}
				}
			}

			no++;
			successCount++;
		} catch (ex) {
			console.error(ex);
			failedCount++;
			continue;
		}

		await delay.range(100, 1000);
	}

	await _puppeteerWrapper.cleanup();

	const doneMessage = `Done scraping processes with keywords "${searchQuery}". Here is the statistic data: ${successCount} success, ${failedCount} failed\n`;

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

	console.log('Done. Close application process.');

	await _logger.exportLogs(_filePaths.logsPath());
})();

//#endregion
