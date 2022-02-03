import Model from './lib/model';

const fixCityName = async (item) => {
	const address = "Ulitsa Bondareva, 9Б, Sortavala, Republic of Karelia, Russia, 186790";
	const addressData = address.includes()
	console.log(addressData);
	// cityName = addressData.length == 0 ? '' : addressData[addressData.length - 1];
}

const main = async () => {
	const items = await Model.Item.findAll({order: [['id', 'desc']]});

	for (const item in items) {
		if (Object.hasOwnProperty.call(items, item)) {
			const itemData = items[item];
			const itemCityName = itemData.item_city;
			let cityName = await Model.CityName.findOne({where: {name: itemCityName}});
			const excludedPlaces = ['States', 'Canada', 'Japan', 'Kingdom', 'Zealand', 'Estonia', 'Jakarta', 'Man',
				'Australia', 'Kong', 'Germany', 'Norway', 'Indonesia', '188990', 'France', 'Austria', 'Sweden',
				'Israel', 'Egypt', 'India', 'Iceland', 'Ireland', 'Netherlands', 'Pakistan', 'Arab', 'Arabia', 'Emirates', 'Bangladesh'];

			if (excludedPlaces.includes(itemCityName)) continue;

			if (cityName == null) {
				console.log("Creating record: ", itemCityName);
				cityName = await Model.CityName.create({
					name: itemCityName
				});
			}

			const itemCity = await Model.City.findOne({where: {items_id: itemData.id}});
			if(itemCity == null) {
				console.log("Create a new record.");
				await Model.CityName.create({
					items_id: itemData.id,
					cities_names_id: cityName.id,
				});
			} else {
				console.log("Update the record.");
				itemCity.update({
					items_id: itemData.id,
					cities_names_id: cityName.id,
				});
			}
		}
	}
}

fixCityName();
