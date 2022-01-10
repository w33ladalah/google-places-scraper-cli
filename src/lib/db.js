import { Sequelize } from "sequelize";
import {DB_HOST, DB_NAME, DB_USER, DB_PASSWORD} from "../config";

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
	host: DB_HOST,
	dialect: 'mysql'
});

sequelize
	.authenticate()
	.then(() => {
		console.log('Connection has been established successfully.'); // eslint-disable-line no-console
	})
	.catch((err) => {
		console.error('Unable to connect to the database:', err); // eslint-disable-line no-console
	});


export default sequelize;
