'use strict';

var _model = require('./lib/model');

const cities = JSON.parse('["Akaa","Alajärvi","Alavus","Espoo","Forssa","Haapajärvi","Haapavesi","Hamina","Hanko","Harjavalta","Heinola","Helsinki","Huittinen","Hyvinkää","Hämeenlinna","Iisalmi","Ikaalinen","Imatra","Pietarsaari","Joensuu","Jyväskylä","Jämsä[b]","Järvenpää","Kaarina","Kajaani","Kalajoki","Kangasala","Kankaanpää","Kannus","Karkkila","Kaskinen","Kauhajoki","Kauhava","Kauniainen","Kemi","Kemijärvi","Kerava","Keuruu","Kitee","Kiuruvesi","Kokemäki","Kokkola","Kotka","Kouvola[c]","Kristiinankaupunki","Kuhmo","Kuopio[d]","Kurikka","Kuusamo","Lahti","Laitila","Lappeenranta[e]","Lapua","Lieksa","Lohja","Loimaa","Loviisa","Maarianhamina","Mikkeli","Mänttä-Vilppula[f]","Naantali","Nivala","Nokia","Nurmes","Uusikaarlepyy","Närpiö","Orimattila","Orivesi","Oulainen","Oulu","Outokumpu","Paimio","Parainen","Parkano","Pieksämäki","Pori","Porvoo","Pudasjärvi","Pyhäjärvi[g]","Raahe","Raasepori","Raisio","Rauma","Riihimäki","Rovaniemi","Saarijärvi","Salo","Sastamala[i]","Savonlinna","Seinäjoki","Somero","Suonenjoki","Tampere","Tornio","Turku","Ulvila","Uusikaupunki","Vaasa","Valkeakoski","Vantaa","Varkaus","Viitasaari","Virrat","Ylivieska","Ylöjärvi","Ähtäri","Äänekoski"]');
cities.forEach(city => {
	_model.CityName.create({
		name: city
	}).then(async data => {
		console.log(data);
	});
});
//# sourceMappingURL=data.js.map