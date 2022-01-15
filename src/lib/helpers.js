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

export default {
	changeLanguage,
	changeLocation,
}
