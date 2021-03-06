import { Logger } from './lib/logger';
import { FilePaths } from './lib/file-paths.js';
import { PuppeteerWrapper } from './lib/puppeteer-wrapper';
import { CSS_SELECTOR as cssSelector, MODEM_URL, MODEM_USER, MODEM_PASSWORD } from './config';
import Model from './lib/model';
import delay from 'delay';
import datejs from 'date.js';
import moment from 'moment';
import yargs from 'yargs';
import JSONdb from 'simple-json-db';
import axios from 'axios';
//#endregion

//#region Setup - Dependency Injection-----------------------------------------------
const _logger = new Logger();
const _filePaths = new FilePaths(_logger, "gmap-scrapper");
const _puppeteerConfig = { headless: true, width: 800, height: 600, args: ['--lang=en-EN,en'] };
const _puppeteerWrapper = new PuppeteerWrapper(_logger, _filePaths, _puppeteerConfig);
const _args = yargs.argv;
//#endregion

const countryCode = 'FI';
const configDb = new JSONdb('./settings.json');

//#region Main ---------------------------------------------------------------------

async function main() {
	let startCity = _args['city'] || _args['c'] || 'Espoo';
	let startCategory = _args['category'] || _args['t'] || 'Association or organization';
	let startQuery = `${startCategory} in ${startCity}, Finland`;
	const scraperId = _args['scraper'] || _args['p'] || '1';
	const cities = await Model.CityName.findAll({order: [['id', 'asc']]});
	const categories = await Model.CategoryName.findAll({order: [['id', 'asc']]});
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

	const lastScrapingActivity = await Model.ScrapingProgress.findOne({
		where: {scraper_id: scraperId},
		order: [['id', 'desc']],
	});

	if (lastScrapingActivity) {
		let currentCityId = parseInt(lastScrapingActivity.city_id),
			currentCategoryId = parseInt(lastScrapingActivity.category_id);

		const lastActivities = await Model.ScrapingProgress.findAll({
			where: {
				scraper_id: scraperId,
				city_id: currentCityId,
				category_id: currentCategoryId,
			},
			order: [['scraping_date', 'desc']],
		});

		// console.log({ 'last city': lastActivities.city_id, 'last category': lastActivities.category_id});return;

		let retryNum = 0;
		while (true) {
			try {
				if(retryNum > 10) {
					const firstCity = await Model.CityName.findOne({ order: [['id', 'asc']] });
					startCity = firstCity.name;
					break;
				}

				if (lastActivities.length > 1) {
					currentCityId = currentCityId + 1;
				}

				const currentCity = await Model.CityName.findOne({where: {id: currentCityId}});
				startCity = currentCity.name;
				break;
			} catch (ex) {
				retryNum++;
				continue;
			}
		}

		retryNum = 0;
		while (true) {
			try {
				if (retryNum > 10) {
					const firstCategory = await Model.CategoryName.findOne({ order: [['id', 'asc']] });
					startCategory = firstCategory.name;
					break;
				}

				if (lastActivities.length > 1) {
					currentCategoryId = currentCategoryId + 1;
				}

				const currentCategory = await Model.CategoryName.findOne({where: {id: currentCategoryId}});
				startCategory = currentCategory.name;
				break;
			} catch (ex) {
				retryNum++;
				continue;
			}
		}

		startQuery = `${startCategory} in ${startCity}, Finland`;
	}

	const startIndex = keywords.map(i => i.query).indexOf(startQuery);

	console.log("==============================================================================================================================================================");
	console.log(`Begin scrapping data with starting query "${startQuery}"`);

	for (let i = startIndex; i < keywords.length; i++) {
		const keyword = keywords[i];

		await Model.ScrapingProgress.create({
			scraper_id: scraperId,
			city_id: keyword.city,
			category_id: keyword.category,
			scraping_date: moment().format('YYYY-MM-DD HH:mm:ss')
		});

		await GMapScrapper(keyword.query, 0, keyword.city, keyword.category);
		await delay.range(200, 600);
	}
}

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

const saveItemWithoutReviews = async (link) => {
	await Model.ItemNoReview.create({link});
}

async function getPageData(url, page, no) {
	console.log('#' + no + ' Processing: "' + url + '...');

	const isModemRestarting = configDb.get('is_modem_restarting') || 0;

	// if (isModemRestarting == 1) {
	// 	await page.waitForTimeout(100000);
	// }

	await page.goto(url);
	await page.waitForNavigation({ waitUntil: 'domcontentloaded' });

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
				await page.goBack({ waitUntil: 'domcontentloaded' });
			} catch (ex) {
				await page.waitForSelector('button.VfPpkd-icon-LgbsSe.yHy1rc.eT1oJ', { waitUntil: 'load', timeout: 2000 });
				await page.click('button.VfPpkd-icon-LgbsSe.yHy1rc.eT1oJ');
			} finally {
				await page.goto(url, { waitUntil: 'load', timeout: 2000 });
			}

			if (allReviews.length == 0) {
				return {};
			}

			await page.waitForNavigation({ waitUntil: "load", timeout: 2000 });

			console.log("Reviews after validation: ", allReviews);

			let placeName = '';
			try {
				//Shop Name
				await page.waitForSelector(".x3AX1-LfntMc-header-title-title span", { waitUntil: 'load', timeout: 2000 });
				placeName = await page.$eval(
					cssSelector['shop_name'],
					(name) => name.textContent
				);

			} catch (ex) {
				await page.screenshot({path: 'screenshots/no-place-name-'+(+new Date)+'.png'});
				console.log("No place name found.");
			}

			let category = ''
			try {
				await page.waitForSelector('button[jsaction="pane.rating.category"]', { waitUntil: 'load', timeout: 2000 });
				category = await page.$eval(
					'button[jsaction="pane.rating.category"]',
					(category) => category.textContent
				);
			} catch (ex) {
				console.log("No category name found.");
			}

			let reviewRating = '';
			try {
				await page.waitForSelector(".x3AX1-LfntMc-header-title-ij8cu-haAclf", { waitUntil: 'load', timeout: 2000 });
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
				await page.waitForSelector(".QSFF4-text.gm2-body-2:nth-child(1)", { waitUntil: 'load', timeout: 2000 });
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
				await page.waitForSelector(cssSelector['website'], { waitUntil: 'load', timeout: 1000 });

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
			} catch(ex) {
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


			const latLong = await getLatLong(url);

			//Hours of works
			const workHours = await getWorkHours(page);

			//Images
			const images = await getImages(page);

			returnObj = {
				placeName: placeName.trim(),
				category: category.trim(),
				rating: typeof reviewRating === 'undefined' ? '' : reviewRating.trim(),
				reviews: reviewCount,
				address: typeof address === 'undefined' ? '' : address.trim(),
				cityName: cityName,
				website: typeof website === 'undefined' ? '' : website.trim(),
				phone: typeof phone === 'undefined' ? '' : phone.trim().replace(/\-/g, ''),
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
		await saveItemWithoutReviews(url);

		return {};
	}
}

const getImages = async (page) => {
	try {
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

			console.log("Collecting images...");
		}

		const images = await page.$$eval(
			'a[data-photo-index] div.loaded',
			(divs) => {
				return Array.from(divs)
					.map((div) => getComputedStyle(div).backgroundImage.replace('url(', '').replace(')', '').replace(/"/g, ''));
			}
		);

		console.log("Images: ", images);

		await page.waitForTimeout(100);
		try {
			await page.goBack({ timeout: 1000, waitUntil: 'networkidle0' });
		} catch (ex) {
			await page.click('button[jsaction="pane.topappbar.back;focus:pane.focusTooltip;blur:pane.blurTooltip"]');
			await page.waitForNavigation({ waitUntil: "networkidle0" });
		}

		return images;
	} catch (ex) {
		return [];
	}
}

const getReviews = async (page, url) => {
	const reviewData = [];

	try {
		const btnTriggerSelector = 'button[jsaction="pane.rating.moreReviews"]';

		await page.waitForSelector(btnTriggerSelector, { waitUntil: 'load', timeout: 1000 });
		await page.click(btnTriggerSelector);
		await page.waitForNavigation({ waitUntil: "domcontentloaded" });

		let newScrollHeight = 0;
		let scrollHeight = _puppeteerConfig['height'] - 200;
		// let divSelector = "#pane > div > div > div > div > div:nth-child(4) > div";
		let divSelector = '#pane .siAUzd-neVct.section-scrollbox.cYB2Ge-oHo7ed.cYB2Ge-ti6hGc';

		while (true) {
			await page.waitForSelector(divSelector, { waitUntil: 'load', timeout: 1000 });

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
				(divs) => {
					const reviewsHTMLs = Array.from(divs).map((div) => div.innerHTML);
					const reviewItems = [];
					for (let i = 0; i < reviewsHTMLs.length; i++) {
						const reviewHTML = reviewsHTMLs[i];
						const parser = new DOMParser();
						const reviewDOM = parser.parseFromString(reviewHTML, 'text/html');
						const reviewText = reviewDOM.querySelector('.ODSEW-ShBeI-ShBeI-content').innerText;
						const startTrimIndex = reviewText.indexOf('(Original)') + 10;
						const dateText = reviewDOM.querySelector('.ODSEW-ShBeI-RgZmSc-date-J42Xof-Hjleke span:nth-child(1)').innerText.trim();

						reviewItems.push({
							author: reviewDOM.querySelector('.ODSEW-ShBeI-title span').innerText.trim(),
							title: reviewDOM.querySelector('.ODSEW-ShBeI-title span').innerText.trim(),
							avatar: reviewDOM.querySelector('img.ODSEW-ShBeI-t1uDwd-HiaYvf').getAttribute('src').trim(),
							rating: reviewDOM.querySelector('.ODSEW-ShBeI-RGxYjb-wcwwM').innerText.replace('/5', '').trim(),
							text: reviewText.indexOf('(Original)') === -1 ? reviewText.trim() : reviewText.substring(startTrimIndex).trim(),
							length: reviewText.indexOf('(Original)') === -1 ? reviewText.trim().length : reviewText.substring(startTrimIndex).trim().length,
							date: dateText,
						});
					}
					return reviewItems;
				}
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

		if(reviews.length === 0) {
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

const getWorkHours = async (page) => {
	try {
		const tableSelector = 'table.y0skZc-jyrRxf-Tydcue.NVpwyf-qJTHM-ibL1re';

		await page.waitForSelector(tableSelector, { waitUntil: 'load', timeout: 1000 });

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
	console.log("Collecting links...");

	// Scrolling to bottom of page
	let newScrollHeight = 0;
	let scrollHeight = _puppeteerConfig['height'];
	let divSelector = '#pane > div > div > div > div > div > div[role="region"]:nth-child(1)';

	while (true) {
		try {
			await page.waitForSelector(divSelector);

			await page.evaluate(
				(scrollHeight, divSelector) =>
					document.querySelector(divSelector).scrollTo(0, scrollHeight),
				scrollHeight,
				divSelector
			);

			await page.waitForTimeout(200);

			newScrollHeight = await page.$eval(
				divSelector,
				(div) => div.scrollHeight
			);

			if (scrollHeight === newScrollHeight) {
				break;
			} else {
				scrollHeight = newScrollHeight;
			}
		} catch (ex) {
			console.log("Finish collecting links...");
			break;
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

	// remove accents, swap ?? for n, etc
	var from = "??????????????????????????????????????????????/_,:;";
	var to = "aaaaeeeeiiiioooouuuunc------";
	for (var i = 0, l = from.length; i < l; i++) {
		str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
	}

	str = str.replace(/[^a-z0-9 -]/g, '') // remove invalid chars
		.replace(/\s+/g, '-') // collapse whitespace and replace by -
		.replace(/-+/g, '-'); // collapse dashes

	return str;
}

const doSkipPlace = async (address='') => {
	const excludedPlaces = await Model.FilteredPlace.findAll();
	// console.log(excludedPlaces);
	for (let i = 0; i < excludedPlaces.length; i++) {
		const excludedPlace = excludedPlaces[i].name;
		if (address.includes(excludedPlace)) {
			console.log('Skipped '+address);
			return true;
		}
	}
	return false;
}

const restartModem = async () => {
	const isModemRestarting = configDb.get('is_modem_restarting') || 0;

	if(isModemRestarting == 0) {
		configDb.set('is_modem_restarting', 1);

		const puppeteerWrapperModem = new PuppeteerWrapper(_logger, _filePaths, { headless: false, randomizeBrowserDimension: true, args: ['--lang=en-EN,en'] });
		const pageModem = await puppeteerWrapperModem.newPage();

		await pageModem.goto(MODEM_URL);
		await pageModem.type('input#Frm_Username', MODEM_USER, { delay: 10 });
		await pageModem.type('input#Frm_Password', MODEM_PASSWORD, { delay: 10 });
		await pageModem.click('input#LoginId');

		await pageModem.waitForTimeout(3000);
		await pageModem.waitForSelector('iframe[src*="template.gch"]', { timeout: 3000 });

		const frameHandle = await pageModem.$('iframe[src="template.gch"]');
		const frame = await frameHandle.contentFrame();

		await frame.click('tr[onclick="javascript:openLink(\'getpage.gch?pid=1002&nextpage=net_tr069_basic_t.gch\')"]');
		await frame.waitForTimeout(1000);
		await frame.click('tr[onclick=\'javascript:OnMenuItemClick("mmManager","smSysMgr"); openLink("getpage.gch?pid=1002&nextpage=manager_dev_conf_t.gch")\']');
		await frame.waitForTimeout(1000);
		await frame.click('input[value="Reboot"]');
		await frame.waitForTimeout(1000);
		await frame.click('input[value="Confirm"]');

		let waitForInternetConnection = setInterval(async () => {
			try {
				const modem = await axios.get('https://google.com');

				if(modem.status === 200) {
					configDb.set('is_modem_restarting', 0);

					clearInterval(waitForInternetConnection);
				} else {
					throw new Error("Still not connected to internet!");
				}
			} catch (ex) {
				console.log('Modem restarting...');
			}
		}, 3000);
	}
}

async function GMapScrapper(searchQuery, maxLinks = 0, city, category) {
	const page = await _puppeteerWrapper.newPage();

	const gmapInitUrl = "https://www.google.com/maps";

	page.on('dialog', async dialog => {
		await delay(300);
		await dialog.accept();
	});

	try {
		await page.goto(gmapInitUrl, { waitUntil: 'domcontentloaded' });
		await changeLocation(countryCode, page);
		await changeLanguage(page);
	} catch (ex) {
		await restartModem();
	}

	await page.waitForNavigation({ waitUntil: "domcontentloaded" });
	await page.waitForSelector('div#gs_lc50 input#searchboxinput');

	await page.type('div#gs_lc50 input#searchboxinput', searchQuery, { delay: 100 });
	await page.keyboard.press('Enter');

	let allLinks = [];
	let linkCount = 0;

	while (
		!(await page.$$eval(
			"#pane > div > div > div > div > div > div > div",
			(elements) =>
				Array.from(elements).some(
					(el) => (el.innerText.trim() == "No results found")
				)
		))
	) {
		if (maxLinks !== 0 && linkCount > maxLinks) break;

		allLinks.push(...(await getLinks(page)));

		await page.$$eval("button", (elements) => {
			return Array.from(elements)
				.find((el) => (el.getAttribute("jsaction") == "pane.paginationSection.nextPage"))
				.click()
		});

		try {
			await page.waitForNavigation({ waitUntil: "load", timeout: 1000 });
		} catch (ex) {
			break;
		}

		linkCount = allLinks.length;

		console.log(`Links count: ${linkCount}`);

		await delay.range(100, 200);
	}

	console.log("Validating results...");

	console.log("All Links ", allLinks.length);

	let uniqueLinks = allLinks.filter(function (value, index, self) {
		return self.indexOf(value) === index;
	});

	if (maxLinks > 0) {
		uniqueLinks = uniqueLinks.slice(0, maxLinks);
	}

	await delay(200);

	console.log("Filtered Links ", uniqueLinks.length);

	let no = 1;
	let successCount = 0;
	let failedCount = 0;
	for (let link of uniqueLinks) {
		if (maxLinks !== 0 && no > maxLinks) break;

		try {
			const itemByLink = await Model.Item.findOne({ where: { link: link } });
			if(itemByLink) {
				console.error("Item exists in database.");
				continue;
			}

			const data = await getPageData(link, page, no);
			const isSkipped = await doSkipPlace(data.address);

			if (isSkipped) continue;

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
						hours_of_work: data.workHours == '[]' || data.workHours == '[{"":""}]' ? '' : data.workHours,
						website: data.website,
						image_remote: data.main_image,
						image: data.main_image,
						phone: data.phone,
						date_created: moment().format('YYYY-MM-DD HH:mm:ss').toString(),
						item_city: data.cityName,
						link: link,
					});

					console.log("Item created: ", item);

					let cityName = Model.CityName.findOne({ where: { name: data.cityName } });
					if (cityName == null && data.cityName != '' && isNaN(parseInt(data.cityName))) {
						cityName = await Model.CityName.create({
							name: data.cityName,
						});
					}


					let categoryName = await Model.CategoryName.findOne({ where: { name: data.category } });
					if (categoryName == null && data.category != '') {
						categoryName = await Model.CategoryName.create({
							name: data.category,
						});
					}

					const existingItemCity = await Model.City.findOne({ where: { items_id: item.id } });
					if (existingItemCity == null) {
						await Model.City.create({
							cities_names_id: cityName.id || city,
							items_id: item.id,
						});
					}

					const existingItemCategory = await Model.Category.findOne({ where: { items_id: item.id } });
					if (existingItemCategory == null && categoryName) {
						await Model.Category.create({
							categories_names_id: categoryName.id,
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
				} else {
					await item.update({phone: data.phone});
				}
			}

			successCount++;
		} catch (ex) {
			console.error(ex);
			failedCount++;
			continue;
		}

		no++;
		await delay.range(100, 200);
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

		process.exit(1);
	} finally {
		await _puppeteerWrapper.cleanup();
	}

	console.log('Done. Close application process.');

	// await _logger.exportLogs(_filePaths.logsPath());
})();

//#endregion
