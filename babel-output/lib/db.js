"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _sequelize = require("sequelize");

var _config = require("../config");

const sequelize = new _sequelize.Sequelize(_config.DB_NAME, _config.DB_USER, _config.DB_PASSWORD, {
	host: _config.DB_HOST,
	dialect: 'mysql'
});

sequelize.authenticate().then(() => {
	console.log('Connection has been established successfully.'); // eslint-disable-line no-console
}).catch(err => {
	console.error('Unable to connect to the database:', err); // eslint-disable-line no-console
});

exports.default = sequelize;
//# sourceMappingURL=db.js.map