const { Sequelize, DataTypes } = require('sequelize');
import sequelize from "./db";

export const CategoryName = sequelize.define('CategoryName', {
	// Model attributes are defined here
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true,
	},
	name: {
		type: DataTypes.STRING,
		allowNull: true,
	},
}, {
	timestamps: false,
	tableName: 'categories_names'
});

export const Category = sequelize.define('Category', {
	// Model attributes are defined here
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true,
	},
	categories_names_id: {
		type: DataTypes.INTEGER,
		allowNull: true,
	},
	items_id: {
		type: DataTypes.INTEGER,
		allowNull: true,
	},
}, {
	timestamps: false,
	tableName: 'categories'
});

export const Item = sequelize.define('Item', {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true,
	},
	name: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	slug: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	address: {
		type: DataTypes.TEXT,
		allowNull: true,
	},
	longitude: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	latitude: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	hours_of_work: {
		type: DataTypes.TEXT,
		allowNull: true,
	},
	website: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	image_remote: {
		type: DataTypes.TEXT,
		allowNull: true,
	},
	image: {
		type: DataTypes.TEXT,
		allowNull: true,
	},
	date_created: {
		type: DataTypes.DATE,
		allowNull: true,
	},
	author_avatar: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	author_name: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	active: {
		type: DataTypes.BOOLEAN,
		allowNull: true,
	},
	active_for_wordai: {
		type: DataTypes.BOOLEAN,
		allowNull: true,
	},
	item_city: {
		type: DataTypes.TEXT,
		allowNull: true,
	},
	link: {
		type: DataTypes.TEXT,
		allowNull: true,
	},
	phone: {
		type: DataTypes.STRING,
		allowNull: true,
	},
}, {
	timestamps: false,
	tableName: 'items'
});

export const ItemNoReview = sequelize.define('ItemNoReview', {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true,
	},
	link: {
		type: DataTypes.TEXT,
		allowNull: true,
	},
}, {
	timestamps: false,
	tableName: 'items_no_reviews'
});

export const Comment = sequelize.define('Comment', {
	// Model attributes are defined here
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true,
	},
	items_id: {
		type: DataTypes.INTEGER,
		allowNull: true,
	},
	title: {
		type: DataTypes.TEXT,
		allowNull: true,
	},
	text: {
		type: DataTypes.TEXT,
		allowNull: true,
	},
	author: {
		type: DataTypes.TEXT,
		allowNull: true,
	},
	avatar: {
		type: DataTypes.STRING,
		allowNull: true,
	},
	rating: {
		type: DataTypes.INTEGER,
		allowNull: true,
		defaultValue: 0,
	},
	user_submit: {
		type: DataTypes.TINYINT,
		allowNull: true,
	},
	date: {
		type: DataTypes.DATE,
		allowNull: true,
	},
	active: {
		type: DataTypes.INTEGER,
		allowNull: true,
		defaultValue: 0,
	},
	queue: {
		type: DataTypes.INTEGER,
		allowNull: true,
	},
}, {
	timestamps: false,
	tableName: 'comments'
});

export const Image = sequelize.define('Image', {
	// Model attributes are defined here
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true,
	},
	items_id: {
		type: DataTypes.INTEGER,
		allowNull: true,
	},
	url: {
		type: DataTypes.TEXT,
		allowNull: true,
	},
}, {
	timestamps: false,
	tableName: 'images'
});

export const CityName = sequelize.define('CityName', {
	// Model attributes are defined here
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true,
	},
	name: {
		type: DataTypes.STRING,
		allowNull: true,
	},
}, {
	timestamps: false,
	tableName: 'cities_names'
});

export const City = sequelize.define('City', {
	// Model attributes are defined here
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true,
	},
	cities_names_id: {
		type: DataTypes.INTEGER,
		allowNull: true,
	},
	items_id: {
		type: DataTypes.INTEGER,
		allowNull: true,
	},
}, {
	timestamps: false,
	tableName: 'cities'
});

export default {
	CategoryName,
	Category,
	Item,
	ItemNoReview,
	Comment,
	Image,
	CityName,
	City,
};
