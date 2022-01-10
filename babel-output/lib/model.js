'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.City = exports.CityName = exports.Image = exports.Comment = exports.Item = exports.Category = exports.CategoryName = undefined;

var _db = require('./db');

var _db2 = _interopRequireDefault(_db);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const { Sequelize, DataTypes } = require('sequelize');
const CategoryName = exports.CategoryName = _db2.default.define('CategoryName', {
	// Model attributes are defined here
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true
	},
	name: {
		type: DataTypes.STRING,
		allowNull: true
	}
}, {
	timestamps: false,
	tableName: 'categories_names'
});

const Category = exports.Category = _db2.default.define('Category', {
	// Model attributes are defined here
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true
	},
	categories_names_id: {
		type: DataTypes.INTEGER,
		allowNull: true
	},
	items_id: {
		type: DataTypes.INTEGER,
		allowNull: true
	}
}, {
	timestamps: false,
	tableName: 'cities'
});

const Item = exports.Item = _db2.default.define('Item', {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true
	},
	name: {
		type: DataTypes.STRING,
		allowNull: true
	},
	slug: {
		type: DataTypes.STRING,
		allowNull: true
	},
	address: {
		type: DataTypes.TEXT,
		allowNull: true
	},
	longitude: {
		type: DataTypes.STRING,
		allowNull: true
	},
	latitude: {
		type: DataTypes.STRING,
		allowNull: true
	},
	hours_of_work: {
		type: DataTypes.TEXT,
		allowNull: true
	},
	website: {
		type: DataTypes.STRING,
		allowNull: true
	},
	image_remote: {
		type: DataTypes.TEXT,
		allowNull: true
	},
	image: {
		type: DataTypes.TEXT,
		allowNull: true
	},
	date_created: {
		type: DataTypes.DATE,
		allowNull: true
	},
	author_avatar: {
		type: DataTypes.STRING,
		allowNull: true
	},
	author_name: {
		type: DataTypes.STRING,
		allowNull: true
	},
	active: {
		type: DataTypes.BOOLEAN,
		allowNull: true
	},
	active_for_wordai: {
		type: DataTypes.BOOLEAN,
		allowNull: true
	},
	item_city: {
		type: DataTypes.TEXT,
		allowNull: true
	}
}, {
	timestamps: false,
	tableName: 'items'
});

const Comment = exports.Comment = _db2.default.define('Comment', {
	// Model attributes are defined here
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true
	},
	items_id: {
		type: DataTypes.INTEGER,
		allowNull: true
	},
	title: {
		type: DataTypes.TEXT,
		allowNull: true
	},
	text: {
		type: DataTypes.TEXT,
		allowNull: true
	},
	author: {
		type: DataTypes.TEXT,
		allowNull: true
	},
	avatar: {
		type: DataTypes.STRING,
		allowNull: true
	},
	rating: {
		type: DataTypes.INTEGER,
		allowNull: true,
		defaultValue: 0
	},
	user_submit: {
		type: DataTypes.TINYINT,
		allowNull: true
	},
	date: {
		type: DataTypes.DATE,
		allowNull: true
	},
	active: {
		type: DataTypes.INTEGER,
		allowNull: true,
		defaultValue: 0
	},
	queue: {
		type: DataTypes.INTEGER,
		allowNull: true
	}
}, {
	timestamps: false,
	tableName: 'comments'
});

const Image = exports.Image = _db2.default.define('Image', {
	// Model attributes are defined here
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true
	},
	items_id: {
		type: DataTypes.INTEGER,
		allowNull: true
	},
	url: {
		type: DataTypes.TEXT,
		allowNull: true
	}
}, {
	timestamps: false,
	tableName: 'images'
});

const CityName = exports.CityName = _db2.default.define('CityName', {
	// Model attributes are defined here
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true
	},
	name: {
		type: DataTypes.STRING,
		allowNull: true
	}
}, {
	timestamps: false,
	tableName: 'cities_names'
});

const City = exports.City = _db2.default.define('City', {
	// Model attributes are defined here
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true
	},
	cities_names_id: {
		type: DataTypes.INTEGER,
		allowNull: true
	},
	items_id: {
		type: DataTypes.INTEGER,
		allowNull: true
	}
}, {
	timestamps: false,
	tableName: 'cities'
});
//# sourceMappingURL=model.js.map