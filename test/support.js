'use strict';

const fs = require('fs'),
	path = require('path'),
	_ = require('lodash'),
	bluebird = require('bluebird'),
	Sequelize = require('sequelize'),
	DataTypes = require('sequelize/lib/data-types'),
	chai = require('chai'),
	{expect} = chai,
	chaiAsPromised = require('chai-as-promised'),
	Config = require('./config/config');

require('../lib/index')(Sequelize);

chai.use(chaiAsPromised);

// Make sure errors get thrown when testing
bluebird.Promise.onPossiblyUnhandledRejection((e) => {
	throw e;
});
bluebird.Promise.longStackTraces();

const Support = {
	Sequelize,

	initTests(options) {
		const sequelize = this.createSequelizeInstance(options);

		this.clearDatabase(sequelize, () => {
			if (options.context) {
				options.context.sequelize = sequelize;
			}

			if (options.beforeComplete) {
				options.beforeComplete(sequelize, DataTypes);
			}

			if (options.onComplete) {
				options.onComplete(sequelize, DataTypes);
			}
		});
	},

	prepareTransactionTest(sequelize, callback) { // eslint-disable-line consistent-return
		const dialect = Support.getTestDialect();

		if (dialect === 'sqlite') {
			const p = path.join(__dirname, 'tmp', 'db.sqlite');

			return new bluebird.Promise(((resolve) => {
				// We cannot promisify exists, since exists does not follow node callback convention -
				// first argument is a boolean, not an error / null
				if (fs.existsSync(p)) {
					resolve(bluebird.Promise.promisify(fs.unlink)(p));
				} else {
					resolve();
				}
			})).then(() => { // eslint-disable-line consistent-return
				const options = Object.assign({}, sequelize.options, {storage: p}),
					_sequelize = new Sequelize(sequelize.config.database, null, null, options);

				if (callback) {
					_sequelize.sync({force: true}).success(() => { callback(_sequelize); });
				} else {
					return _sequelize.sync({force: true}).return(_sequelize);
				}
			});
		}
		if (callback) {
			callback(sequelize);
		} else {
			return bluebird.Promise.resolve(sequelize);
		}
	},

	createSequelizeInstance(options) {
		options = options || {};
		options.dialect = this.getTestDialect();

		const config = Config[options.dialect];

		const sequelizeOptions = _.defaults(options, {
			host: options.host || config.host,
			logging: (process.env.SEQ_LOG ? console.log : false), // eslint-disable-line no-console
			dialect: options.dialect,
			port: options.port || process.env.SEQ_PORT || config.port,
			pool: config.pool,
			dialectOptions: options.dialectOptions || {}
		});

		if (process.env.DIALECT === 'postgres-native') {
			sequelizeOptions.native = true;
		}

		if (config.storage) {
			sequelizeOptions.storage = config.storage;
		}

		return this.getSequelizeInstance(
			config.database, config.username, config.password, sequelizeOptions
		);
	},

	getSequelizeInstance(db, user, pass, options) {
		options = options || {};
		options.dialect = options.dialect || this.getTestDialect();
		return new Sequelize(db, user, pass, options);
	},

	clearDatabase(sequelize) {
		return sequelize
			.drop()
			.then(() => {
				if (sequelize.modelManager.daos) sequelize.modelManager.daos = [];
				if (sequelize.modelManager.models) sequelize.modelManager.models = [];
				sequelize.models = {};

				const dialect = Support.getTestDialect();

				if (dialect === 'postgres') {
					return sequelize
						.getQueryInterface()
						.dropAllEnums();
				}
			});
	},

	getSupportedDialects() {
		return fs.readdirSync(`${__dirname}/../node_modules/sequelize/lib/dialects`).filter(file => ((file.indexOf('.js') === -1) && (file.indexOf('abstract') === -1)));
	},

	checkMatchForDialects(dialect, value, expectations) {
		if (expectations[dialect]) {
			expect(value).to.match(expectations[dialect]);
		} else {
			throw new Error(`Undefined expectation for "${dialect}"!`);
		}
	},

	getTestDialect() {
		let envDialect = process.env.DIALECT || 'mysql';

		if (envDialect === 'postgres-native') {
			envDialect = 'postgres';
		}

		if (this.getSupportedDialects().indexOf(envDialect) === -1) {
			throw new Error(`The dialect you have passed is unknown. Did you really mean: ${envDialect}`);
		}

		return envDialect;
	},

	dialectIsMySQL(strict) {
		const envDialect = process.env.DIALECT || 'mysql';
		if (strict === undefined) {
			strict = false;
		}

		if (strict) {
			return envDialect === 'mysql';
		}
		return ['mysql', 'mariadb'].indexOf(envDialect) !== -1;
	},

	getTestDialectTeaser(moduleName) {
		let dialect = this.getTestDialect();

		if (process.env.DIALECT === 'postgres-native') {
			dialect = 'postgres-native';
		}

		return `[${dialect.toUpperCase()}] ${moduleName}`;
	},

	getTestUrl(config) {
		let url;
		const dbConfig = config[config.dialect];

		if (config.dialect === 'sqlite') {
			url = `sqlite://${dbConfig.storage}`;
		} else {
			let credentials = dbConfig.username;
			if (dbConfig.password) {
				credentials += `:${dbConfig.password}`;
			}

			url = `${config.dialect}://${credentials}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;
		}
		return url;
	},

	expectsql(query, expectations) {
		let expectation = expectations[Support.sequelize.dialect.name];

		if (!expectation && Support.sequelize.dialect.name === 'mariadb') {
			expectation = expectations.mysql;
		}

		if (!expectation) {
			expectation = expectations.default
				.replace(/\[/g, Support.sequelize.dialect.TICK_CHAR_LEFT)
				.replace(/\]/g, Support.sequelize.dialect.TICK_CHAR_RIGHT);
		}

		expect(query).to.equal(expectation);
	}
};

beforeEach(function() {
	this.sequelize = Support.sequelize; // eslint-disable-line no-invalid-this
});

Support.sequelize = Support.createSequelizeInstance();
module.exports = Support;
