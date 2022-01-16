const APP_NAME = "GMap Scrapper";
const APP_VERSION = "1.0.0";
const CSS_SELECTOR = {
	'shop_name': ".x3AX1-LfntMc-header-title-title span",
	'rating': ".x3AX1-LfntMc-header-title-ij8cu-haAclf span > span > span",
	'reviews': 'button[jsaction="pane.rating.moreReviews"]',
	'address': 'button[data-item-id="address"] div.QSFF4-text',
	'address_backup': "#pane > div > div > div > div > div > div > button > div > div > div",
	'website': 'button[data-item-id="authority"] div.QSFF4-text',
	'phone': 'button[data-item-id^="phone"]',
	'reviews_btn': 'button[jsaction="pane.reviewlist.goToReviews"]',
	'reviews_item': 'div[jsaction="mouseover:pane.review.in;mouseout:pane.review.out"]',
};
const DB_HOST = 'localhost';
const DB_NAME = 'finland_places';
const DB_USER = 'root';
const DB_PASSWORD = 'rootpassword';

export {
	APP_NAME,
	APP_VERSION,
	CSS_SELECTOR,
	DB_HOST,
	DB_NAME,
	DB_USER,
	DB_PASSWORD,
};
