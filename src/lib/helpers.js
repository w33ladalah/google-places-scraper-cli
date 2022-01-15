export const changeLocation = async (countryCode, page) => {
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

export const changeLanguage = async (page) => {
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

export default {
	changeLanguage,
	changeLocation,
}
