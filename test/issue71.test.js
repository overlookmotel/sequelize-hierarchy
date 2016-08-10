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
			var DataTypes = Sequelize;
			this.Category = this.sequelize.define('Category', {
				id: {
					type: DataTypes.UUID,
					defaultValue: DataTypes.UUIDV1,
					primaryKey: true
				},
				name: {
					type: DataTypes.STRING,
					allowNull: false,
					validate: {
						notEmpty: true
					}
				}
			}, {
				hierarchy: {
					onDelete: 'CASCADE'
				},
				indexes: [{
					unique: true,
					fields: ['name', 'parentId']
				}],
				paranoid: true,
			});

			this.Categoryancestor = this.sequelize.models.Categoryancestor;

			return this.sequelize.sync({ force: true }).bind(this)
			.then(function() {
				return Promise.each([
					{
						id: '5039635c-4c41-11e6-beb8-9e71128cae77',
						name: 'Root',
						parentId: null
					},
					{
						id: '2a66b960-4c62-11e6-87a6-3fe2d2c90f85',
						name: 'News',
						parentId: '5039635c-4c41-11e6-beb8-9e71128cae77'
					},
					{
						id: 'cbc28106-4c6f-11e6-beb8-9e71128cae77',
						name: 'Sport',
						parentId: '5039635c-4c41-11e6-beb8-9e71128cae77'
					},
					{
						id: 'a370e650-4c62-11e6-b7f0-25a307d90784',
						name: 'Business',
						parentId: '2a66b960-4c62-11e6-87a6-3fe2d2c90f85'
					},
					{
						id: 'bd39da10-4c62-11e6-b7f0-25a307d90784',
						name: 'Education',
						parentId: '2a66b960-4c62-11e6-87a6-3fe2d2c90f85'
					},
					{
						id: 'fdc8b546-4ccc-11e6-beb8-9e71128cae77',
						name: 'Deleted',
						parentId: 'cbc28106-4c6f-11e6-beb8-9e71128cae77'
					},
					{
						id: 'cbc286e2-4c6f-11e6-beb8-9e71128cae77',
						name: 'Football',
						parentId: 'cbc28106-4c6f-11e6-beb8-9e71128cae77'
					},
					{
						id: 'e16f7176-4c6f-11e6-beb8-9e71128cae77',
						name: 'Rugby league',
						parentId: 'cbc28106-4c6f-11e6-beb8-9e71128cae77'
					}
				], function(categoryParams) {
					return this.Category.create(categoryParams);
				}.bind(this)).bind(this).then(function() {
					return this.Category.destroy({where: {id: 'fdc8b546-4ccc-11e6-beb8-9e71128cae77'}});
				});
			});
		});

		afterEach(function() {
			// set parentId of all folders to null
			// (to avoid foreign constraint error in SQLite when dropping table)
			//return this.Category.update({parentId: null}, {where: {parentId: {ne: null}}, hooks: false});
		});

		describe('#findAll', function() {
			describe('can retrieve', function() {
				it('descendents', function() {
					var Category = this.Category;
					return Category.findAll({
						attributes: ['id', 'name', 'parentId'],
						where: {
							parentId: '5039635c-4c41-11e6-beb8-9e71128cae77'
						},
						include: [{
							model: Category,
							as: 'descendents',
							attributes: ['id', 'name', 'parentId'],
							hierarchy: true
						}],
						offset: 0,
						limit: 10,
						order: [
							['name', 'ASC'],
							[{
								model: Category,
								as: 'descendents'
							}, 'name', 'ASC']
						],
						logging: console.log
					}).bind(this)
					.then(function(categories) {
						var categoriesPlain = categories.map(function(category) {
							return {
								id: category.id,
								name: category.name,
								children: category.children.map(function(child) {
									return {id: child.id, name: child.name};
								})
							};
						});

						console.log('categories:', require('util').inspect(categoriesPlain, {depth: null}));

						expect(categories.length).to.equal(2);
						expect(categories[1].name).to.equal('Sport');
						expect(categories[1].children.length).to.equal(2);
					});
				});
			});
		});
	});
});
