import datejs from 'date.js';
import delay from 'delay';
import moment from 'moment';

export const getImages = async (page) => {
	try {
		console.log("Getting images...");

		await page.waitForSelector('button[jsaction="pane.heroHeaderImage.click"]', { timeout: 5000 });
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
					.map((div) => getComputedStyle(div).backgroundImage.replace('url(', '').replace(')', '').replaceAll('"', ''));
			}
		);

		console.log("Images: ", images);

		await page.waitForTimeout(2000);
		await page.click('button[jsaction="pane.topappbar.back;focus:pane.focusTooltip;blur:pane.blurTooltip"]');
		await page.waitForNavigation({ waitUntil: "networkidle0" });

		return images;
	} catch (ex) {
		console.error(ex);
		return [];
	}
}

export const getReviews = async (page) => {
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
		}

		await page.$$eval('[jsaction="pane.review.expandReview"]', async (elHandles) => {
			elHandles.forEach(el => el.click());
			await delay(700);
		});

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
						text: reviewText.substring(startTrimIndex).trim(),
						date: dateInEnglish,
					};
				})
		);

		await page.waitForTimeout(2000);
		await page.click('button.VfPpkd-icon-LgbsSe.yHy1rc.eT1oJ');
		await page.waitForNavigation({ waitUntil: "networkidle0" });

		const reviewData = [];

		for (let i = 0; i < reviews.length; i++) {
			const review = reviews[i];
			review['date'] = moment(datejs(review['date'])).format('YYYY-MM-DD HH:mm:ss').toString();
			reviewData.push(review);
		}

		// console.log("Reviews data: ", reviewData);

		return reviewData;
	} catch (ex) {
		console.error(ex);
		return [];
	}
}

export const getWorkHours = async (page) => {
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

const getPageData = async (url, page) => {
	console.log(`Processing ${url}...`);

	await page.goto(url);

	//Shop Name
	await page.waitForSelector(".x3AX1-LfntMc-header-title-title span");
	const itemName = await page.$eval(
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

	const latLong = getLatLong(url);

	//Hours of works
	const workHours = JSON.stringify(await getWorkHours(page));

	//Images
	const images = await getImages(page);

	//Reviews
	const allReviews = await getReviews(page);

	let returnObj = {};

	try {
		returnObj = {
			name: itemName.trim(),
			rating: reviewRating === undefined ? '' : reviewRating.trim(),
			reviews: reviewCount,
			address: address === undefined ? '' : address.trim(),
			website: website === undefined ? '' : website.trim(),
			phone: phone === undefined ? '' : phone.trim().replace(/\-/g, ''),
			latitude: (latLong[0] || "").toString().substring(0, 15),
			longitude: (latLong[1] || "").toString().substring(0, 15),
			main_image: images[0] || '',
			all_images: images,
			all_reviews: allReviews,
			workHours: workHours,
		};
	} catch (exception) {
		console.log(exception);
	}

	return returnObj;
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

export default {

}
