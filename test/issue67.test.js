// --------------------
// Sequelize hierarchy
// Tests
// --------------------

// modules
var chai = require('chai'),
	expect = chai.expect, // jshint ignore: line
	promised = require('chai-as-promised'),
	Support = require(__dirname + '/support'),
	Sequelize = Support.Sequelize,
	Promise = Sequelize.Promise; // jshint ignore: line

var sequelizeVersion = Sequelize.version || require('sequelize/package.json').version;

// init
chai.use(promised);
chai.config.includeStack = true;

// tests

/* jshint expr: true */
/* global describe, it, beforeEach */

console.log('Sequelize version:', sequelizeVersion);
console.log('Dialect:', Support.sequelize.options.dialect);

describe(Support.getTestDialectTeaser('Tests'), function () {
	beforeEach(function() {
		return Support.clearDatabase(this.sequelize);
	});

	describe('Issue #67', function() {
		it('does no throw on sequelize.sync()', function() {
			this.sequelize.define('product', {
			    asin: {
			        type: Sequelize.STRING
			    },
			    parent_asin: { // jshint ignore:line
			        type: Sequelize.STRING
			    },
				title: {
			        type: Sequelize.STRING
			    }
			}, {
			    hierarchy:{
			        primaryKey: 'asin',
			        foreignKey: 'parent_asin'
			    },
			    tableName: 'products'
			});

			return this.sequelize.sync({ force: true, logging: console.log });
		});
	});
});
