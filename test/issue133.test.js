// --------------------
// Sequelize hierarchy
// Tests
// --------------------

// modules
var chai = require('chai'),
	expect = chai.expect,
	promised = require('chai-as-promised'),
	Support = require(__dirname + '/support'),
	Sequelize = Support.Sequelize,
	Promise = Sequelize.Promise;

var sequelizeVersion = Sequelize.version || require('sequelize/package.json').version;

// init
chai.use(promised);
chai.config.includeStack = true;

// tests

/* jshint expr: true */
/* global describe, it, beforeEach, afterEach */

console.log('Sequelize version:', sequelizeVersion);
console.log('Dialect:', Support.sequelize.options.dialect);

describe(Support.getTestDialectTeaser('Tests'), function () {
	describe('Methods', function() {
		beforeEach(function() {
			this.Category = this.sequelize.define('Category', {
				name: {
					type: Sequelize.STRING,
					allowNull: false
				}
			}, {underscored: true});

			this.Category.isHierarchy();

			return this.sequelize.sync({ force: true }).bind(this)
			.then(function() {
				this.categories = {};

				return Promise.each([
					{name: 'a', parentName: null},
					{name: 'ac', parentName: 'a'},
					{name: 'ab', parentName: 'a'},
					{name: 'abe', parentName: 'ab'},
					{name: 'abd', parentName: 'ab'},
					{name: 'abdg', parentName: 'abd'},
					{name: 'abdf', parentName: 'abd'}
				], function(params) {
					// get parent
					var parent = this.categories[params.parentName];
					params.parent_id = parent ? parent.id : null; // jshint ignore:line

					return this.Category.create(params).bind(this)
					.then(function(category) {
						this.categories[category.name] = category;
					});
				}.bind(this));
			});
		});

		afterEach(function() {
			// set parentId of all folders to null
			// (to avoid foreign constraint error in SQLite when dropping table)
			return this.Category.update({parent_id: null}, {where: {parent_id: {ne: null}}, hooks: false}); // jshint ignore:line
		});

		describe('#findAll', function() {
			describe('can retrieve', function() {
				it('descendents', function() {
					return this.Category.findAll({
						hierarchy: true,
						attributes: ['id', 'parent_id', 'name'],
						logging: console.log
					}).bind(this)
					.then(function(categories) {
						categories = makePlain(categories);

						console.log('categories:', require('util').inspect(categories, {depth: null}));

						expect(categories).to.deep.equal([
							{name: 'a', children: [
								{name: 'ac'},
								{name: 'ab', children: [
									{name: 'abe'},
									{name: 'abd', children: [
										{name: 'abdg'},
										{name: 'abdf'}
									]}
								]}
							]}
						]);
					});
				});
			});
		});
	});
});

function makePlain(categories) {
	return categories.map(function(category) {
		var out = {
			//id: category.id,
			//parent_id: category.parent_id, // jshint ignore:line
			name: category.name
		};

		if (category.children) out.children = makePlain(category.children);

		return out;
	});
}
