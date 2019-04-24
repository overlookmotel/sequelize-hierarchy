// --------------------
// Sequelize hierarchy
// Tests
// --------------------

/* eslint-disable no-invalid-this */

'use strict';

// modules
const chai = require('chai'),
	{expect} = chai,
	promised = require('chai-as-promised'),
	Support = require('./support'), // eslint-disable-line import/order
	{Sequelize} = Support,
	{Promise} = Sequelize,
	semverSelect = require('semver-select');

// eslint-disable-next-line global-require
const sequelizeVersion = Sequelize.version || require('sequelize/package.json').version;

// init
chai.use(promised);
chai.config.includeStack = true;

// tests

console.log('Sequelize version:', sequelizeVersion); // eslint-disable-line no-console
console.log('Dialect:', Support.sequelize.options.dialect); // eslint-disable-line no-console

describe(Support.getTestDialectTeaser('Tests'), () => {
	// run tests
	beforeEach(function() {
		this.schema = undefined;

		return Support.clearDatabase(this.sequelize);
	});

	after(function() {
		this.sequelize.close();
	});

	tests();

	// if postgres, run tests again with schemas
	if (Support.sequelize.options.dialect === 'postgres') {
		describe('With schemas', () => {
			before(() => { // eslint-disable-line arrow-body-style
				return Support.sequelize.query('CREATE SCHEMA IF NOT EXISTS "schematest"');
			});

			beforeEach(function() {
				this.schema = 'schematest';
			});

			tests();
		});
	}
});

function tests() {
	describe('Hierarchy creation', () => {
		it('works via isHierarchy()', function() {
			const folder = this.sequelize.define('folder', {
				name: Sequelize.STRING
			});

			folder.isHierarchy({camelThrough: true});

			expect(folder.hierarchy).to.be.ok;
		});

		it('works via define options', function() {
			const folder = this.sequelize.define('folder', {
				name: Sequelize.STRING
			}, {
				hierarchy: {camelThrough: true}
			});

			expect(folder.hierarchy).to.be.ok;
		});

		it('works via defining in model attribute', function() {
			const folder = this.sequelize.define('folder', {
				name: Sequelize.STRING,
				parId: {
					type: Sequelize.INTEGER.UNSIGNED,
					allowNull: true,
					hierarchy: {camelThrough: true}
				}
			});

			expect(folder.hierarchy).to.be.ok;
			expect(folder.hierarchy.foreignKey).to.equal('parId');
			expect(folder.hierarchy.as).to.equal('par');
		});

		it('allows parentId and hierarchyLevel fields to already be defined', function() {
			const folder = this.sequelize.define('folder', {
				name: Sequelize.STRING,
				hierarchyLevel: Sequelize.STRING,
				parentId: Sequelize.INTEGER
			});

			folder.isHierarchy({camelThrough: true});

			expect(folder.attributes.hierarchyLevel.type).not.to.equal(Sequelize.STRING);

			expect(folder.attributes.parentId.references).to.deep.equal(
				semverSelect(sequelizeVersion, {
					'<3.0.1': 'folders',
					'>=3.0.1': {model: 'folders', key: 'id'}
				})
			);
		});

		describe('options', () => {
			beforeEach(function() {
				this.folder = this.sequelize.define('folder', {
					name: Sequelize.STRING
				});

				this.folder.isHierarchy({
					through: 'folderAncestor',
					throughTable: 'folder_ancestor',
					throughSchema: 'folder_schema'
				});

				this.throughModel = this.sequelize.models.folderAncestor;
			});

			it('`through`', function() {
				expect(this.folder.hierarchy).to.be.ok;
				expect(this.throughModel).to.be.ok;
			});

			it('`throughTable`', function() {
				expect(this.throughModel.tableName).to.equal('folder_ancestor');
			});

			it('`throughSchema`', function() {
				expect(this.throughModel.getTableName().schema).to.equal('folder_schema');
			});
		});
	});

	describe('Methods', () => {
		beforeEach(function() {
			this.folder = this.sequelize.define('folder', {
				name: Sequelize.STRING
			}, {
				// scopes do not affect the behavior of the model unless
				// 'switched on' with a Model.scope(name) call
				scopes: {
					// return the objects with the drive populated
					withDrive: (() => ({
						include: [{
							model: this.drive
						}]
					}))
				},
				schema: this.schema
			});

			this.folder.isHierarchy({camelThrough: true});

			this.folderAncestor = this.sequelize.models.folderAncestor;

			this.drive = this.sequelize.define('drive', {
				name: Sequelize.STRING
			}, {
				schema: this.schema
			});

			this.drive.hasMany(this.folder);
			this.folder.belongsTo(this.drive);

			return this.sequelize.sync({force: true})
				.then(() => { // eslint-disable-line arrow-body-style
					return this.drive.create({name: 'a'});
				})
				.then((drive) => {
					this.drives = {a: drive};
					this.folders = {};

					// NB folders are created not in name order to ensure ordering
					// works correctly in later tests
					// https://github.com/overlookmotel/sequelize-hierarchy/issues/32
					return Promise.each([
						{name: 'a', parentName: null},
						{name: 'ac', parentName: 'a'},
						{name: 'ab', parentName: 'a'},
						{name: 'abe', parentName: 'ab'},
						{name: 'abd', parentName: 'ab'},
						{name: 'abdg', parentName: 'abd'},
						{name: 'abdf', parentName: 'abd'}
					], (folderParams) => {
						// get parent
						const parent = this.folders[folderParams.parentName];
						folderParams.parentId = parent ? parent.id : null;

						return drive.createFolder({
							name: folderParams.name,
							parentId: folderParams.parentId
						})
							.then((folder) => {
								this.folders[folder.name] = folder;
							});
					});
				});
		});

		afterEach(function() {
			// set parentId of all folders to null
			// (to avoid foreign constraint error in SQLite when dropping table)
			return this.folder.update(
				{parentId: null},
				{where: {parentId: {ne: null}}, hooks: false}
			);
		});

		describe('#create', () => {
			describe('for root level', () => {
				it('sets hierarchyLevel', function() {
					return this.folder.find({where: {name: 'a'}})
						.then((folder) => {
							expect(folder.hierarchyLevel).to.equal(1);
						});
				});

				it('creates hierarchy table records', function() {
					return this.folderAncestor.findAll({
						where: {folderId: this.folders.a.id}
					})
						.then((ancestors) => {
							expect(ancestors.length).to.equal(0);
						});
				});
			});

			describe('for 2nd level', () => {
				it('sets hierarchyLevel', function() {
					return this.folder.find({where: {name: 'ab'}})
						.then((folder) => {
							expect(folder.hierarchyLevel).to.equal(2);
						});
				});

				it('creates hierarchy table records', function() {
					return this.folderAncestor.findAll({
						where: {folderId: this.folders.ab.id}
					})
						.then((ancestors) => {
							expect(ancestors.length).to.equal(1);
							expect(ancestors[0].ancestorId).to.equal(this.folders.a.id);
						});
				});
			});

			describe('for 3rd level', () => {
				it('sets hierarchyLevel', function() {
					return this.folder.find({where: {name: 'abd'}})
						.then((folder) => {
							expect(folder.hierarchyLevel).to.equal(3);
						});
				});

				it('creates hierarchy table records', function() {
					return this.folderAncestor.findAll({
						where: {folderId: this.folders.abd.id},
						order: [['ancestorId']]
					})
						.then((ancestors) => {
							expect(ancestors.length).to.equal(2);
							expect(ancestors[0].ancestorId).to.equal(this.folders.a.id);
							expect(ancestors[1].ancestorId).to.equal(this.folders.ab.id);
						});
				});
			});

			describe('throws', () => {
				it('if creating child of itself', function() {
					return this.folder.max('id')
						.then((id) => { // eslint-disable-line arrow-body-style
							return expect(
								this.folder.create({id: id + 1, parentId: id + 1})
							).to.be.rejectedWith(
								this.sequelize.HierarchyError,
								'Parent cannot be a child of itself'
							);
						});
				});
			});
		});

		describe('#updateAttributes', () => {
			describe('for root level', () => {
				beforeEach(function() {
					return this.folders.abdf.updateAttributes({parentId: null});
				});

				it('sets hierarchyLevel', function() {
					return this.folder.find({where: {name: 'abdf'}})
						.then((folder) => {
							expect(folder.hierarchyLevel).to.equal(1);
						});
				});

				it('updates hierarchy table records', function() {
					return this.folderAncestor.findAll({
						where: {folderId: this.folders.abdf.id}
					})
						.then((ancestors) => {
							expect(ancestors.length).to.equal(0);
						});
				});
			});

			describe('for 2nd level', () => {
				beforeEach(function() {
					return this.folders.abdf.updateAttributes({parentId: this.folders.a.id});
				});

				it('sets hierarchyLevel', function() {
					return this.folder.find({where: {name: 'abdf'}})
						.then((folder) => {
							expect(folder.hierarchyLevel).to.equal(2);
						});
				});

				it('updates hierarchy table records', function() {
					return this.folderAncestor.findAll({
						where: {folderId: this.folders.abdf.id}
					})
						.then((ancestors) => {
							expect(ancestors.length).to.equal(1);
							expect(ancestors[0].ancestorId).to.equal(this.folders.a.id);
						});
				});
			});

			describe('for 3rd level', () => {
				beforeEach(function() {
					return this.folders.abdf.updateAttributes({parentId: this.folders.ab.id});
				});

				it('sets hierarchyLevel', function() {
					return this.folder.find({where: {name: 'abdf'}})
						.then((folder) => {
							expect(folder.hierarchyLevel).to.equal(3);
						});
				});

				it('updates hierarchy table records', function() {
					return this.folderAncestor.findAll({
						where: {folderId: this.folders.abdf.id},
						order: [['ancestorId']]
					})
						.then((ancestors) => {
							expect(ancestors.length).to.equal(2);
							expect(ancestors[0].ancestorId).to.equal(this.folders.a.id);
							expect(ancestors[1].ancestorId).to.equal(this.folders.ab.id);
						});
				});
			});

			describe('descendents', () => {
				beforeEach(function() {
					return this.folders.ab.updateAttributes({parentId: this.folders.ac.id});
				});

				it('sets hierarchyLevel for descendents', function() {
					return this.folder.find({where: {name: 'abdf'}})
						.then((folder) => {
							expect(folder.hierarchyLevel).to.equal(5);
						});
				});

				it('updates hierarchy table records for descendents', function() {
					return this.folder.find({
						where: {id: this.folders.abdf.id},
						include: [{model: this.folder, as: 'ancestors'}],
						order: [[{model: this.folder, as: 'ancestors'}, 'hierarchyLevel']]
					})
						.then((folder) => {
							const {ancestors} = folder;
							expect(ancestors.length).to.equal(4);
							expect(ancestors[0].id).to.equal(this.folders.a.id);
							expect(ancestors[1].id).to.equal(this.folders.ac.id);
							expect(ancestors[2].id).to.equal(this.folders.ab.id);
							expect(ancestors[3].id).to.equal(this.folders.abd.id);
						});
				});
			});

			describe('throws', () => {
				it('if making item child of itself', function() {
					return expect(
						this.folders.a.updateAttributes({parentId: this.folders.a.id})
					).to.be.rejectedWith(
						this.sequelize.HierarchyError,
						'Parent cannot be a child of itself'
					);
				});

				it('if making item child of one of its own descendents', function() {
					return expect(
						this.folders.a.updateAttributes({parentId: this.folders.ab.id})
					).to.be.rejectedWith(
						this.sequelize.HierarchyError,
						'Parent cannot be a child of itself'
					);
				});
			});
		});

		describe('#destroy', () => {
			it('removes hierarchy table records', function() {
				return this.folders.abdf.destroy()
					.then(() => { // eslint-disable-line arrow-body-style
						return this.folderAncestor.findAll({
							where: {folderId: this.folders.abdf.id}
						});
					})
					.then((ancestors) => {
						expect(ancestors.length).to.equal(0);
					});
			});

			it('throws error if try to destroy a record which has children', function() {
				const promise = this.folders.a.destroy();
				return expect(promise).to.be.rejectedWith(Sequelize.ForeignKeyConstraintError);
			});
		});

		describe('#bulkCreate', () => {
			beforeEach(function() {
				return this.folder.bulkCreate([
					{name: 'abeh', parentId: this.folders.abe.id},
					{name: 'abi', parentId: this.folders.ab.id}
				]);
			});

			it('sets hierarchyLevel for all rows', function() {
				return this.folder.find({where: {name: 'abeh'}})
					.then((folder) => {
						expect(folder.hierarchyLevel).to.equal(4);

						return this.folder.find({where: {name: 'abi'}});
					})
					.then((folder) => {
						expect(folder.hierarchyLevel).to.equal(3);
					});
			});

			it('creates hierarchy table records for all rows', function() {
				return this.folder.find({
					where: {name: 'abeh'},
					include: [{model: this.folder, as: 'ancestors'}],
					order: [[{model: this.folder, as: 'ancestors'}, 'hierarchyLevel']]
				})
					.then((folder) => {
						const {ancestors} = folder;
						expect(ancestors.length).to.equal(3);
						expect(ancestors[0].id).to.equal(this.folders.a.id);
						expect(ancestors[1].id).to.equal(this.folders.ab.id);
						expect(ancestors[2].id).to.equal(this.folders.abe.id);

						return this.folder.find({
							where: {name: 'abi'},
							include: [{model: this.folder, as: 'ancestors'}],
							order: [[{model: this.folder, as: 'ancestors'}, 'hierarchyLevel']]
						});
					})
					.then((folder) => {
						const {ancestors} = folder;
						expect(ancestors.length).to.equal(2);
						expect(ancestors[0].id).to.equal(this.folders.a.id);
						expect(ancestors[1].id).to.equal(this.folders.ab.id);
					});
			});
		});

		describe('#bulkUpdate', () => {
			beforeEach(function() {
				return this.folder.update(
					{parentId: this.folders.ab.id},
					{where: {parentId: this.folders.abd.id}}
				);
			});

			it('sets hierarchyLevel for all rows', function() {
				return Promise.each(
					['abdf', 'abdg'],
					(name) => { // eslint-disable-line arrow-body-style
						return this.folder.find({where: {name}})
							.then((folder) => {
								expect(folder.hierarchyLevel).to.equal(3);
							});
					}
				);
			});

			it('creates hierarchy table records for all rows', function() {
				return Promise.each(
					['abdf', 'abdg'],
					(name) => { // eslint-disable-line arrow-body-style
						return this.folder.find({
							where: {name},
							include: [{model: this.folder, as: 'ancestors'}],
							order: [[{model: this.folder, as: 'ancestors'}, 'hierarchyLevel']]
						})
							.then((folder) => {
								const {ancestors} = folder;
								expect(ancestors.length).to.equal(2);
								expect(ancestors[0].id).to.equal(this.folders.a.id);
								expect(ancestors[1].id).to.equal(this.folders.ab.id);
							});
					}
				);
			});
		});

		describe('#bulkDestroy', () => {
			it('removes hierarchy table records for all rows', function() {
				return this.folder.destroy({where: {parentId: this.folders.abd.id}})
					.then(() => { // eslint-disable-line arrow-body-style
						return Promise.each(
							['abdf', 'abdg'],
							(name) => { // eslint-disable-line arrow-body-style
								return this.folderAncestor.findAll({
									where: {folderId: this.folders[name].id}
								})
									.then((ancestors) => {
										expect(ancestors.length).to.equal(0);
									});
							}
						);
					});
			});

			it('throws error if try to destroy a record which has children', function() {
				const promise = this.folder.destroy({where: {parentId: this.folders.ab.id}});
				return expect(promise).to.be.rejectedWith(Sequelize.ForeignKeyConstraintError);
			});
		});

		describe('#find', () => {
			describe('can retrieve', () => {
				it('children', function() {
					return this.folder.find({
						where: {name: 'a'},
						include: [{model: this.folder, as: 'children'}],
						order: [[{model: this.folder, as: 'children'}, 'name']]
					})
						.then((folder) => {
							expect(folder.children.length).to.equal(2);
							expect(folder.children[0].name).to.equal('ab');
							expect(folder.children[1].name).to.equal('ac');
						});
				});

				it('descendents', function() {
					return this.folder.find({
						where: {name: 'a'},
						include: [{model: this.folder, as: 'descendents'}],
						order: [[{model: this.folder, as: 'descendents'}, 'name']]
					})
						.then((folder) => {
							expect(folder.descendents.length).to.equal(6);
							expect(folder.descendents[0].name).to.equal('ab');
							expect(folder.descendents[1].name).to.equal('abd');
							expect(folder.descendents[2].name).to.equal('abdf');
							expect(folder.descendents[3].name).to.equal('abdg');
							expect(folder.descendents[4].name).to.equal('abe');
							expect(folder.descendents[5].name).to.equal('ac');
						});
				});

				it('parent', function() {
					return this.folder.find({
						where: {name: 'abdf'},
						include: [{model: this.folder, as: 'parent'}]
					})
						.then((folder) => {
							expect(folder.parent).to.be.ok;
							expect(folder.parent.name).to.equal('abd');
						});
				});

				it('ancestors', function() {
					return this.folder.find({
						where: {name: 'abdf'},
						include: [{model: this.folder, as: 'ancestors'}],
						order: [[{model: this.folder, as: 'ancestors'}, 'hierarchyLevel']]
					})
						.then((folder) => {
							expect(folder.ancestors.length).to.equal(3);
							expect(folder.ancestors[0].name).to.equal('a');
							expect(folder.ancestors[1].name).to.equal('ab');
							expect(folder.ancestors[2].name).to.equal('abd');
						});
				});

				it('other associations', function() {
					return this.folder.find({
						where: {name: 'abdf'},
						include: this.drive
					})
						.then((folder) => {
							expect(folder.drive).to.be.ok;
							expect(folder.drive.name).to.equal(this.drives.a.name);
						});
				});
			});

			describe('with hierarchy option', () => {
				it('findAll gets a structured tree', function() {
					return this.folder.findAll({order: [['name']], hierarchy: true})
						.then((folders) => {
							expect(folders.length).to.equal(1);
							const folder = folders[0];

							expect(folder.name).to.equal('a');
							expect(folder.children).to.exist;
							expect(folder.children.length).to.equal(2);
							expect(folder.children[0].name).to.equal('ab');
							expect(folder.children[1].name).to.equal('ac');

							expect(folder.children[0].children).to.exist;
							expect(folder.children[0].children.length).to.equal(2);
							expect(folder.children[0].children[0].name).to.equal('abd');
							expect(folder.children[0].children[1].name).to.equal('abe');

							expect(folder.children[1].children).not.to.exist;

							expect(folder.children[0].children[0].children).to.exist;
							expect(folder.children[0].children[0].children.length).to.equal(2);
							expect(folder.children[0].children[0].children[0].name).to.equal('abdf');
							expect(folder.children[0].children[0].children[1].name).to.equal('abdg');

							expect(folder.children[0].children[1].children).not.to.exist;

							expect(folder.children[0].children[0].children[0].children).not.to.exist;
							expect(folder.children[0].children[0].children[1].children).not.to.exist;
						});
				});

				it('find gets a structured tree', function() {
					return this.folder.find({
						where: {name: 'a'},
						include: [{model: this.folder, as: 'descendents', hierarchy: true}],
						order: [[{model: this.folder, as: 'descendents'}, 'name']]
					})
						.then((folder) => {
							expect(folder.name).to.equal('a');
							expect(folder.children).to.exist;
							expect(folder.children.length).to.equal(2);
							expect(folder.children[0].name).to.equal('ab');
							expect(folder.children[1].name).to.equal('ac');

							expect(folder.children[0].children).to.exist;
							expect(folder.children[0].children.length).to.equal(2);
							expect(folder.children[0].children[0].name).to.equal('abd');
							expect(folder.children[0].children[1].name).to.equal('abe');

							expect(folder.children[1].children).not.to.exist;

							expect(folder.children[0].children[0].children).to.exist;
							expect(folder.children[0].children[0].children.length).to.equal(2);
							expect(folder.children[0].children[0].children[0].name).to.equal('abdf');
							expect(folder.children[0].children[0].children[1].name).to.equal('abdg');

							expect(folder.children[0].children[1].children).not.to.exist;

							expect(folder.children[0].children[0].children[0].children).not.to.exist;
							expect(folder.children[0].children[0].children[1].children).not.to.exist;
						});
				});

				it('find gets a structured tree when included from another model', function() {
					return this.drive.findAll({
						include: {
							model: this.folder,
							where: {name: 'a'},
							include: {model: this.folder, as: 'descendents', hierarchy: true}
						},
						order: [[{model: this.folder}, {model: this.folder, as: 'descendents'}, 'name']]
					})
						.then((drives) => {
							expect(drives.length).to.equal(1);
							expect(drives[0].folders).to.be.ok;
							expect(drives[0].folders.length).to.equal(1);

							const folder = drives[0].folders[0];

							expect(folder.name).to.equal('a');
							expect(folder.children).to.exist;
							expect(folder.children.length).to.equal(2);
							expect(folder.children[0].name).to.equal('ab');
							expect(folder.children[1].name).to.equal('ac');

							expect(folder.children[0].children).to.exist;
							expect(folder.children[0].children.length).to.equal(2);
							expect(folder.children[0].children[0].name).to.equal('abd');
							expect(folder.children[0].children[1].name).to.equal('abe');

							expect(folder.children[1].children).not.to.exist;

							expect(folder.children[0].children[0].children).to.exist;
							expect(folder.children[0].children[0].children.length).to.equal(2);
							expect(folder.children[0].children[0].children[0].name).to.equal('abdf');
							expect(folder.children[0].children[0].children[1].name).to.equal('abdg');

							expect(folder.children[0].children[1].children).not.to.exist;

							expect(folder.children[0].children[0].children[0].children).not.to.exist;
							expect(folder.children[0].children[0].children[1].children).not.to.exist;
						});
				});

				it('find gets a structured tree when included from another model 2 deep', function() {
					return this.folder.find({
						where: {name: 'a'},
						include: {
							model: this.drive,
							include: {
								model: this.folder,
								where: {name: 'a'},
								include: {model: this.folder, as: 'descendents', hierarchy: true}
							}
						},
						order: [[
							{model: this.drive},
							{model: this.folder},
							{model: this.folder, as: 'descendents'},
							'name'
						]]
					})
						.then((folder) => {
							expect(folder.name).to.equal('a');

							const {drive} = folder;
							expect(drive.folders).to.be.ok;
							expect(drive.folders.length).to.equal(1);

							folder = drive.folders[0];

							expect(folder.name).to.equal('a');
							expect(folder.children).to.exist;
							expect(folder.children.length).to.equal(2);
							expect(folder.children[0].name).to.equal('ab');
							expect(folder.children[1].name).to.equal('ac');

							expect(folder.children[0].children).to.exist;
							expect(folder.children[0].children.length).to.equal(2);
							expect(folder.children[0].children[0].name).to.equal('abd');
							expect(folder.children[0].children[1].name).to.equal('abe');

							expect(folder.children[1].children).not.to.exist;

							expect(folder.children[0].children[0].children).to.exist;
							expect(folder.children[0].children[0].children.length).to.equal(2);
							expect(folder.children[0].children[0].children[0].name).to.equal('abdf');
							expect(folder.children[0].children[0].children[1].name).to.equal('abdg');

							expect(folder.children[0].children[1].children).not.to.exist;

							expect(folder.children[0].children[0].children[0].children).not.to.exist;
							expect(folder.children[0].children[0].children[1].children).not.to.exist;
						});
				});

				it('works with `raw` option', function() {
					return this.folder.findAll({
						order: [['name']],
						hierarchy: true,
						raw: true
					})
						.then((folders) => {
							expect(folders.length).to.equal(1);
							const folder = folders[0];

							expect(folder.name).to.equal('a');
							expect(folder.children).to.exist;
							expect(folder.children.length).to.equal(2);
							expect(folder.children[0].name).to.equal('ab');
							expect(folder.children[1].name).to.equal('ac');

							expect(folder.children[0].children).to.exist;
							expect(folder.children[0].children.length).to.equal(2);
							expect(folder.children[0].children[0].name).to.equal('abd');
							expect(folder.children[0].children[1].name).to.equal('abe');

							expect(folder.children[1].children).not.to.exist;

							expect(folder.children[0].children[0].children).to.exist;
							expect(folder.children[0].children[0].children.length).to.equal(2);
							expect(folder.children[0].children[0].children[0].name).to.equal('abdf');
							expect(folder.children[0].children[0].children[1].name).to.equal('abdg');

							expect(folder.children[0].children[1].children).not.to.exist;

							expect(folder.children[0].children[0].children[0].children).not.to.exist;
							expect(folder.children[0].children[0].children[1].children).not.to.exist;
						});
				});
			});

			describe('works with scoped models', () => {
				beforeEach(function() {
					this.scopedFolder = this.folder.scope('withDrive');
				});

				it('with main model scoped', function() {
					return this.scopedFolder.find({
						where: {name: 'a'},
						include: [{model: this.folder, as: 'descendents', hierarchy: true}],
						order: [[{model: this.folder, as: 'descendents'}, 'name']]
					})
						.then((folder) => {
							expect(folder.drive).to.be.ok;
							expect(folder.drive.name).to.equal(this.drives.a.name);

							[
								{folder: folder.children[0], name: 'ab', numChildren: 2},
								{folder: folder.children[0].children[0], name: 'abd', numChildren: 2},
								{folder: folder.children[0].children[0].children[0], name: 'abdf'},
								{folder: folder.children[0].children[0].children[1], name: 'abdg'},
								{folder: folder.children[0].children[1], name: 'abe'},
								{folder: folder.children[1], name: 'ac'}
							].forEach((params) => {
								const thisFolder = params.folder;
								expect(thisFolder).to.be.ok;
								expect(thisFolder.name).to.equal(params.name);
								if (params.numChildren) {
									expect(thisFolder.children).to.be.ok;
									expect(thisFolder.children.length).to.equal(params.numChildren);
								} else {
									expect(thisFolder.children).to.be.undefined;
								}

								expect(thisFolder.drive).to.be.undefined;
							});
						});
				});

				it('with hierarchy model scoped', function() {
					return this.folder.find({
						where: {name: 'a'},
						include: [{model: this.scopedFolder, as: 'descendents', hierarchy: true}],
						order: [[{model: this.scopedFolder, as: 'descendents'}, 'name']]
					})
						.then((folder) => {
							expect(folder.drive).to.be.undefined;

							[
								{folder: folder.children[0], name: 'ab', numChildren: 2},
								{folder: folder.children[0].children[0], name: 'abd', numChildren: 2},
								{folder: folder.children[0].children[0].children[0], name: 'abdf'},
								{folder: folder.children[0].children[0].children[1], name: 'abdg'},
								{folder: folder.children[0].children[1], name: 'abe'},
								{folder: folder.children[1], name: 'ac'}
							].forEach((params) => {
								const thisFolder = params.folder;
								expect(thisFolder).to.be.ok;
								expect(thisFolder.name).to.equal(params.name);
								if (params.numChildren) {
									expect(thisFolder.children).to.be.ok;
									expect(thisFolder.children.length).to.equal(params.numChildren);
								} else {
									expect(thisFolder.children).to.be.undefined;
								}

								expect(thisFolder.drive).to.be.ok;
								expect(thisFolder.drive.name).to.equal(this.drives.a.name);
							});
						});
				});

				it('with both models scoped', function() {
					return this.scopedFolder.find({
						where: {name: 'a'},
						include: [{model: this.scopedFolder, as: 'descendents', hierarchy: true}],
						order: [[{model: this.scopedFolder, as: 'descendents'}, 'name']]
					})
						.then((folder) => {
							expect(folder.drive).to.be.ok;
							expect(folder.drive.name).to.equal(this.drives.a.name);

							[
								{folder: folder.children[0], name: 'ab', numChildren: 2},
								{folder: folder.children[0].children[0], name: 'abd', numChildren: 2},
								{folder: folder.children[0].children[0].children[0], name: 'abdf'},
								{folder: folder.children[0].children[0].children[1], name: 'abdg'},
								{folder: folder.children[0].children[1], name: 'abe'},
								{folder: folder.children[1], name: 'ac'}
							].forEach((params) => {
								const thisFolder = params.folder;
								expect(thisFolder).to.be.ok;
								expect(thisFolder.name).to.equal(params.name);
								if (params.numChildren) {
									expect(thisFolder.children).to.be.ok;
									expect(thisFolder.children.length).to.equal(params.numChildren);
								} else {
									expect(thisFolder.children).to.be.undefined;
								}

								expect(thisFolder.drive).to.be.ok;
								expect(thisFolder.drive.name).to.equal(this.drives.a.name);
							});
						});
				});
			});

			describe('handles empty result set with', () => {
				it('#find', function() {
					return this.folder.find({where: {name: 'z'}})
						.then((folder) => {
							expect(folder).to.be.null;
						});
				});

				it('#findAll', function() {
					return this.folder.findAll({where: {name: 'z'}})
						.then((folders) => {
							expect(folders.length).to.equal(0);
						});
				});

				it('#find with an include', function() {
					return this.folder.find({
						where: {name: 'z'},
						include: [{model: this.folder, as: 'parent'}]
					})
						.then((folder) => {
							expect(folder).to.be.null;
						});
				});

				it('#find with an empty include', function() {
					return this.folder.find({
						where: {name: 'a'},
						include: [{model: this.folder, as: 'parent'}]
					})
						.then((folder) => {
							expect(folder.parent).to.be.null;
						});
				});

				it('#find with empty descendents', function() {
					return this.folder.find({
						where: {name: 'abdg'},
						include: [{model: this.folder, as: 'descendents', hierarchy: true}]
					})
						.then((folder) => {
							expect(folder.children.length).to.equal(0);
						});
				});
			});
		});

		describe('accessors', () => {
			describe('can retrieve', () => {
				it('children', function() {
					return this.folders.a.getChildren({order: [['name']]})
						.then((folders) => {
							expect(folders.length).to.equal(2);
							expect(folders[0].name).to.equal('ab');
							expect(folders[1].name).to.equal('ac');
						});
				});

				it('descendents', function() {
					return this.folders.a.getDescendents({order: [['name']]})
						.then((folders) => {
							expect(folders.length).to.equal(6);
							expect(folders[0].name).to.equal('ab');
							expect(folders[1].name).to.equal('abd');
							expect(folders[2].name).to.equal('abdf');
							expect(folders[3].name).to.equal('abdg');
							expect(folders[4].name).to.equal('abe');
							expect(folders[5].name).to.equal('ac');
						});
				});

				it('parent', function() {
					return this.folders.abdf.getParent()
						.then((folder) => {
							expect(folder).to.be.ok;
							expect(folder.name).to.equal('abd');
						});
				});

				it('ancestors', function() {
					return this.folders.abdf.getAncestors({order: [['hierarchyLevel']]})
						.then((folders) => {
							expect(folders.length).to.equal(3);
							expect(folders[0].name).to.equal('a');
							expect(folders[1].name).to.equal('ab');
							expect(folders[2].name).to.equal('abd');
						});
				});
			});

			describe('with hierarchy option', () => {
				it('getDescendents gets a structured tree', function() {
					return this.folders.a.getDescendents({
						order: [['name']],
						hierarchy: true
					})
						.then((folders) => {
							expect(folders.length).to.equal(2);
							expect(folders[0].name).to.equal('ab');
							expect(folders[1].name).to.equal('ac');

							expect(folders[0].children).to.exist;
							expect(folders[0].children.length).to.equal(2);
							expect(folders[0].children[0].name).to.equal('abd');
							expect(folders[0].children[1].name).to.equal('abe');

							expect(folders[1].children).not.to.exist;

							expect(folders[0].children[0].children).to.exist;
							expect(folders[0].children[0].children.length).to.equal(2);
							expect(folders[0].children[0].children[0].name).to.equal('abdf');
							expect(folders[0].children[0].children[1].name).to.equal('abdg');

							expect(folders[0].children[1].children).not.to.exist;

							expect(folders[0].children[0].children[0].children).not.to.exist;
							expect(folders[0].children[0].children[1].children).not.to.exist;
						});
				});
			});
		});

		describe('setters', () => {
			describe('legal', () => {
				it('setParent', function() {
					return this.folders.abdg.setParent(this.folders.a)
						.then(() => { // eslint-disable-line arrow-body-style
							return this.folder.find({where: {name: 'abdg'}});
						}).then((folder) => {
							expect(folder.parentId).to.equal(this.folders.a.id);
							expect(folder.hierarchyLevel).to.equal(2);
						});
				});

				describe('createParent', () => {
					beforeEach(function() {
						return this.folders.abd.createParent({
							name: 'ach',
							parentId: this.folders.ac.id
						})
							.then(() => { // eslint-disable-line arrow-body-style
								return this.folder.find({where: {name: 'ach'}});
							})
							.then((folder) => {
								this.folders.ach = folder;
							});
					});

					describe('creates new item', () => {
						it('with correct parent', function() {
							expect(this.folders.ach.parentId).to.equal(this.folders.ac.id);
						});

						it('with correct hierarchyLevel', function() {
							expect(this.folders.ach.hierarchyLevel).to.equal(3);
						});

						it('with correct hierarchy table entries', function() {
							return this.folderAncestor.findAll({
								where: {folderId: this.folders.ach.id},
								order: [['ancestorId']]
							})
								.then((ancestors) => {
									expect(ancestors.length).to.equal(2);
									expect(ancestors[0].ancestorId).to.equal(this.folders.a.id);
									expect(ancestors[1].ancestorId).to.equal(this.folders.ac.id);
								});
						});
					});

					describe('sets current item', () => {
						it('to correct parent', function() {
							return this.folder.find({where: {name: 'abd'}})
								.then((folder) => {
									expect(folder.parentId).to.equal(this.folders.ach.id);
								});
						});

						it('with correct hierarchyLevel', function() {
							return this.folder.find({where: {name: 'abd'}})
								.then((folder) => {
									expect(folder.hierarchyLevel).to.equal(4);
								});
						});

						it('with correct hierarchy table entries', function() {
							return this.folderAncestor.findAll({
								where: {folderId: this.folders.abd.id},
								order: [['ancestorId']]
							})
								.then((ancestors) => {
									expect(ancestors.length).to.equal(3);
									expect(ancestors[0].ancestorId).to.equal(this.folders.a.id);
									expect(ancestors[1].ancestorId).to.equal(this.folders.ac.id);
									expect(ancestors[2].ancestorId).to.equal(this.folders.ach.id);
								});
						});
					});
				});

				it('addChild', function() {
					return this.folders.a.addChild(this.folders.abdg)
						.then(() => { // eslint-disable-line arrow-body-style
							return this.folder.find({where: {name: 'abdg'}});
						})
						.then((folder) => {
							expect(folder.parentId).to.equal(this.folders.a.id);
							expect(folder.hierarchyLevel).to.equal(2);
						});
				});

				describe('createChild', () => {
					beforeEach(function() {
						return this.folders.ac.createChild({name: 'ach'})
							.then(() => { // eslint-disable-line arrow-body-style
								return this.folder.find({where: {name: 'ach'}});
							})
							.then((folder) => {
								this.folders.ach = folder;
							});
					});

					it('with correct parent', function() {
						expect(this.folders.ach.parentId).to.equal(this.folders.ac.id);
					});

					it('with correct hierarchyLevel', function() {
						expect(this.folders.ach.hierarchyLevel).to.equal(3);
					});

					it('with correct hierarchy table entries', function() {
						return this.folderAncestor.findAll({
							where: {folderId: this.folders.ach.id},
							order: [['ancestorId']]
						})
							.then((ancestors) => {
								expect(ancestors.length).to.equal(2);
								expect(ancestors[0].ancestorId).to.equal(this.folders.a.id);
								expect(ancestors[1].ancestorId).to.equal(this.folders.ac.id);
							});
					});
				});
			});

			describe('illegal methods not present', () => {
				[
					{accessor: 'set', plural: true},
					{accessor: 'add'},
					{accessor: 'add', plural: true},
					{accessor: 'create'},
					{accessor: 'remove'},
					{accessor: 'remove', plural: true}
				].forEach((params) => {
					let accessor = `${params.accessor}${params.plural ? 'Descendents' : 'Descendent'}`;
					it(accessor, function() {
						expect(this.folders.ac[accessor]).to.be.undefined;
					});

					accessor = `${params.accessor}${params.plural ? 'Ancestors' : 'Ancestor'}`;
					it(accessor, function() {
						expect(this.folders.ac[accessor]).to.be.undefined;
					});
				});
			});
		});

		describe('#rebuildHierarchy', () => {
			beforeEach(function() {
				return this.folderAncestor.destroy({where: {}})
					.then(() => { // eslint-disable-line arrow-body-style
						return this.folder.update({hierarchyLevel: 999}, {where: {id: {ne: 0}}});
					})
					.then(() => { // eslint-disable-line arrow-body-style
						return this.folder.rebuildHierarchy();
					});
			});

			it('recreates hierarchyLevel for all records', function() {
				return this.folder.findAll()
					.then((folders) => {
						folders.forEach((folder) => {
							expect(folder.hierarchyLevel).to.equal(folder.name.length);
						});
					});
			});

			it('recreates hierarchy table records', function() {
				return this.folderAncestor.findAll({
					where: {ancestorId: this.folders.a.id},
					order: [['folderId']]
				})
					.then((descendents) => {
						expect(descendents.length).to.equal(6);
						expect(descendents[0].folderId).to.equal(this.folders.ac.id);
						expect(descendents[1].folderId).to.equal(this.folders.ab.id);
						expect(descendents[2].folderId).to.equal(this.folders.abe.id);
						expect(descendents[3].folderId).to.equal(this.folders.abd.id);
						expect(descendents[4].folderId).to.equal(this.folders.abdg.id);
						expect(descendents[5].folderId).to.equal(this.folders.abdf.id);
					});
			});
		});
	});

	describe('Options', () => {
		describe('underscored', () => {
			it('underscores field names and foreign keys', function() {
				const folder = this.sequelize.define(
					'folder',
					{name: Sequelize.STRING},
					{underscored: true}
				);

				folder.isHierarchy();

				expect(folder.attributes).to.have.property('hierarchy_level');
				expect(folder.attributes).to.have.property('parent_id');
				expect(folder.associations.ancestors.through.model.attributes).to.have.property('folder_id');
				expect(folder.associations.ancestors.through.model.attributes).to.have.property('ancestor_id');
				expect(folder.associations.ancestors.foreignKey).to.equal('folder_id');
				expect(folder.associations.children.foreignKey).to.equal('parent_id');
			});

			it('does not override user supplied field names', function() {
				const folder = this.sequelize.define(
					'folder',
					{name: Sequelize.STRING},
					{underscored: true}
				);

				folder.isHierarchy({
					levelFieldName: 'testFieldName',
					foreignKey: 'testForeignKey',
					throughKey: 'testThroughKey',
					throughForeignKey: 'testThroughForeignKey'
				});

				expect(folder.attributes).to.have.property('testFieldName');
				expect(folder.attributes).to.have.property('testForeignKey');
				expect(folder.associations.ancestors.through.model.attributes).to.have.property('testThroughForeignKey');
				expect(folder.associations.ancestors.through.model.attributes).to.have.property('testThroughKey');
				expect(folder.associations.ancestors.foreignKey).to.equal('testThroughKey');
				expect(folder.associations.children.foreignKey).to.equal('testForeignKey');
				expect(folder.associations.ancestors.through.model.tableName).to.equal('foldersancestors');
			});
		});

		describe('underscoredAll', () => {
			beforeEach(function() {
				this.sequelize.options.define.underscoredAll = true;
			});

			afterEach(function() {
				delete this.sequelize.options.define.underscoredAll;
			});

			it('underscores through table name', function() {
				const folder = this.sequelize.define('folder', {
					name: Sequelize.STRING
				});

				folder.isHierarchy();

				expect(folder.associations.ancestors.through.model.tableName).to.equal('folders_ancestors');
			});

			it('does not override user supplied `throughTable` option', function() {
				const folder = this.sequelize.define('folder', {
					name: Sequelize.STRING
				});

				folder.isHierarchy({throughTable: 'testThroughTable'});

				expect(folder.associations.ancestors.through.model.tableName).to.equal('testThroughTable');
			});
		});
	});
}
