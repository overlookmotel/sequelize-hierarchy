/* --------------------
 * Sequelize hierarchy
 * Tests
 * ------------------*/

/* eslint-disable no-invalid-this */

'use strict';

// Modules
const chai = require('chai'),
	{expect} = chai,
	promised = require('chai-as-promised'),
	semverSelect = require('semver-select'),
	Support = require('./support'),
	{Sequelize} = Support;

// eslint-disable-next-line global-require, import/order
const sequelizeVersion = Sequelize.version || require('sequelize/package.json').version;

// Init
chai.use(promised);
chai.config.includeStack = true;

// Define attributes getter function, dependent on Sequelize version
const attributes = semverSelect(sequelizeVersion, {
	'2.0.0 - 4.x.x': model => model.attributes,
	'>=5.0.0': model => model.rawAttributes
});

// Define findOne function, dependent on Sequelize version
const findOne = semverSelect(sequelizeVersion, {
	'2.0.0 - 3.x.x': (model, options) => model.find(options),
	'>=4.0.0': (model, options) => model.findOne(options)
});

// Tests

console.log('Sequelize version:', sequelizeVersion); // eslint-disable-line no-console
console.log('Dialect:', Support.sequelize.options.dialect); // eslint-disable-line no-console

describe(Support.getTestDialectTeaser('Tests'), () => {
	// Run tests
	beforeEach(async function() {
		this.schema = undefined;

		await Support.clearDatabase(this.sequelize);
	});

	after(function() {
		this.sequelize.close();
	});

	tests();

	// If postgres, run tests again with schemas
	if (Support.sequelize.options.dialect === 'postgres') {
		describe('With schemas', () => {
			before(async () => {
				await Support.sequelize.query('CREATE SCHEMA IF NOT EXISTS "schematest"');
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
		describe('with .define', () => {
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

				expect(attributes(folder).hierarchyLevel.type).not.to.equal(Sequelize.STRING);

				expect(attributes(folder).parentId.references).to.deep.equal(
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

		// Only run tests for `.init` on Sequelize 4+
		const describeFiltered = semverSelect(sequelizeVersion, {
			'2.0.0 - 3.x.x': describe.skip,
			'>=4.0.0': describe
		});

		describeFiltered('with .init', () => {
			it('works via isHierarchy()', function() {
				class folder extends Sequelize.Model {}
				folder.init({
					name: Sequelize.STRING
				}, {sequelize: this.sequelize});

				folder.isHierarchy({camelThrough: true});

				expect(folder.hierarchy).to.be.ok;
			});

			it('works via define options', function() {
				class folder extends Sequelize.Model {}
				folder.init({
					name: Sequelize.STRING
				}, {
					sequelize: this.sequelize,
					hierarchy: {camelThrough: true}
				});

				expect(folder.hierarchy).to.be.ok;
			});

			it('works via defining in model attribute', function() {
				class folder extends Sequelize.Model {}
				folder.init({
					name: Sequelize.STRING,
					parId: {
						type: Sequelize.INTEGER.UNSIGNED,
						allowNull: true,
						hierarchy: {camelThrough: true}
					}
				}, {sequelize: this.sequelize});

				expect(folder.hierarchy).to.be.ok;
				expect(folder.hierarchy.foreignKey).to.equal('parId');
				expect(folder.hierarchy.as).to.equal('par');
			});

			it('allows parentId and hierarchyLevel fields to already be defined', function() {
				class folder extends Sequelize.Model {}
				folder.init({
					name: Sequelize.STRING,
					hierarchyLevel: Sequelize.STRING,
					parentId: Sequelize.INTEGER
				}, {sequelize: this.sequelize});

				folder.isHierarchy({camelThrough: true});

				expect(attributes(folder).hierarchyLevel.type).not.to.equal(Sequelize.STRING);

				expect(attributes(folder).parentId.references).to.deep.equal(
					semverSelect(sequelizeVersion, {
						'<3.0.1': 'folders',
						'>=3.0.1': {model: 'folders', key: 'id'}
					})
				);
			});

			describe('options', () => {
				beforeEach(function() {
					class folder extends Sequelize.Model {}
					folder.init({
						name: Sequelize.STRING
					}, {sequelize: this.sequelize});

					folder.isHierarchy({
						through: 'folderAncestor',
						throughTable: 'folder_ancestor',
						throughSchema: 'folder_schema'
					});

					this.folder = folder;

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
	});

	describe('Methods', () => {
		beforeEach(async function() {
			this.folder = this.sequelize.define('folder', {
				name: Sequelize.STRING
			}, {
				// Scopes do not affect the behavior of the model unless
				// 'switched on' with a Model.scope(name) call
				scopes: {
					// Return the objects with the drive populated
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

			await this.sequelize.sync({force: true});

			const drive = await this.drive.create({name: 'a'});
			this.drives = {a: drive};
			this.folders = {};

			// NB folders are created not in name order to ensure ordering
			// works correctly in later tests
			// https://github.com/overlookmotel/sequelize-hierarchy/issues/32
			for (const folderParams of [
				{name: 'a', parentName: null},
				{name: 'ac', parentName: 'a'},
				{name: 'ab', parentName: 'a'},
				{name: 'abe', parentName: 'ab'},
				{name: 'abd', parentName: 'ab'},
				{name: 'abdg', parentName: 'abd'},
				{name: 'abdf', parentName: 'abd'}
			]) {
				// Get parent
				const parent = this.folders[folderParams.parentName];
				folderParams.parentId = parent ? parent.id : null;

				this.folders[folderParams.name] = await drive.createFolder({
					name: folderParams.name,
					parentId: folderParams.parentId
				});
			}
		});

		afterEach(async function() {
			// Set parentId of all folders to null to avoid foreign constraint error
			// in SQLite when dropping table
			await this.folder.update(
				{parentId: null},
				{where: {}, hooks: false}
			);
		});

		describe('#create', () => {
			describe('for root level', () => {
				it('sets hierarchyLevel', async function() {
					const folder = await findOne(this.folder, {where: {name: 'a'}});
					expect(folder.hierarchyLevel).to.equal(1);
				});

				it('creates hierarchy table records', async function() {
					const ancestors = await this.folderAncestor.findAll({
						where: {folderId: this.folders.a.id}
					});
					expect(ancestors.length).to.equal(0);
				});
			});

			describe('for 2nd level', () => {
				it('sets hierarchyLevel', async function() {
					const folder = await findOne(this.folder, {where: {name: 'ab'}});
					expect(folder.hierarchyLevel).to.equal(2);
				});

				it('creates hierarchy table records', async function() {
					const ancestors = await this.folderAncestor.findAll({
						where: {folderId: this.folders.ab.id}
					});
					expect(ancestors.length).to.equal(1);
					expect(ancestors[0].ancestorId).to.equal(this.folders.a.id);
				});
			});

			describe('for 3rd level', () => {
				it('sets hierarchyLevel', async function() {
					const folder = await findOne(this.folder, {where: {name: 'abd'}});
					expect(folder.hierarchyLevel).to.equal(3);
				});

				it('creates hierarchy table records', async function() {
					const ancestors = await this.folderAncestor.findAll({
						where: {folderId: this.folders.abd.id},
						order: [['ancestorId']]
					});
					expect(ancestors.length).to.equal(2);
					expect(ancestors[0].ancestorId).to.equal(this.folders.a.id);
					expect(ancestors[1].ancestorId).to.equal(this.folders.ab.id);
				});
			});

			describe('throws', () => {
				it('if creating child of itself', async function() {
					const id = await this.folder.max('id');
					await expect(
						this.folder.create({id: id + 1, parentId: id + 1})
					).to.be.rejectedWith(
						this.sequelize.HierarchyError,
						'Parent cannot be a child of itself'
					);
				});
			});
		});

		describe('#update', () => {
			describe('for root level', () => {
				beforeEach(async function() {
					await this.folders.abdf.update({parentId: null});
				});

				it('sets hierarchyLevel', async function() {
					const folder = await findOne(this.folder, {where: {name: 'abdf'}});
					expect(folder.hierarchyLevel).to.equal(1);
				});

				it('updates hierarchy table records', async function() {
					const ancestors = await this.folderAncestor.findAll({
						where: {folderId: this.folders.abdf.id}
					});
					expect(ancestors.length).to.equal(0);
				});
			});

			describe('for 2nd level', () => {
				beforeEach(async function() {
					await this.folders.abdf.update({parentId: this.folders.a.id});
				});

				it('sets hierarchyLevel', async function() {
					const folder = await findOne(this.folder, {where: {name: 'abdf'}});
					expect(folder.hierarchyLevel).to.equal(2);
				});

				it('updates hierarchy table records', async function() {
					const ancestors = await this.folderAncestor.findAll({
						where: {folderId: this.folders.abdf.id}
					});
					expect(ancestors.length).to.equal(1);
					expect(ancestors[0].ancestorId).to.equal(this.folders.a.id);
				});
			});

			describe('for 3rd level', () => {
				beforeEach(async function() {
					await this.folders.abdf.update({parentId: this.folders.ab.id});
				});

				it('sets hierarchyLevel', async function() {
					const folder = await findOne(this.folder, {where: {name: 'abdf'}});
					expect(folder.hierarchyLevel).to.equal(3);
				});

				it('updates hierarchy table records', async function() {
					const ancestors = await this.folderAncestor.findAll({
						where: {folderId: this.folders.abdf.id},
						order: [['ancestorId']]
					});
					expect(ancestors.length).to.equal(2);
					expect(ancestors[0].ancestorId).to.equal(this.folders.a.id);
					expect(ancestors[1].ancestorId).to.equal(this.folders.ab.id);
				});
			});

			describe('descendents', () => {
				beforeEach(async function() {
					await this.folders.ab.update({parentId: this.folders.ac.id});
				});

				it('sets hierarchyLevel for descendents', async function() {
					const folder = await findOne(this.folder, {where: {name: 'abdf'}});
					expect(folder.hierarchyLevel).to.equal(5);
				});

				it('updates hierarchy table records for descendents', async function() {
					const folder = await findOne(this.folder, {
						where: {id: this.folders.abdf.id},
						include: [{model: this.folder, as: 'ancestors'}],
						order: [[{model: this.folder, as: 'ancestors'}, 'hierarchyLevel']]
					});
					const {ancestors} = folder;
					expect(ancestors.length).to.equal(4);
					expect(ancestors[0].id).to.equal(this.folders.a.id);
					expect(ancestors[1].id).to.equal(this.folders.ac.id);
					expect(ancestors[2].id).to.equal(this.folders.ab.id);
					expect(ancestors[3].id).to.equal(this.folders.abd.id);
				});
			});

			describe('throws', () => {
				it('if making item child of itself', async function() {
					await expect(
						this.folders.a.update({parentId: this.folders.a.id})
					).to.be.rejectedWith(
						this.sequelize.HierarchyError,
						'Parent cannot be a child of itself'
					);
				});

				it('if making item child of one of its own descendents', async function() {
					await expect(
						this.folders.a.update({parentId: this.folders.ab.id})
					).to.be.rejectedWith(
						this.sequelize.HierarchyError,
						'Parent cannot be a descendent of itself'
					);
				});
			});
		});

		describe('#destroy', () => {
			it('removes hierarchy table records', async function() {
				await this.folders.abdf.destroy();
				const ancestors = await this.folderAncestor.findAll({
					where: {folderId: this.folders.abdf.id}
				});
				expect(ancestors.length).to.equal(0);
			});

			it('throws error if try to destroy a record which has children', async function() {
				const promise = this.folders.a.destroy();
				await expect(promise).to.be.rejectedWith(Sequelize.ForeignKeyConstraintError);
			});
		});

		describe('#bulkCreate', () => {
			beforeEach(async function() {
				await this.folder.bulkCreate([
					{name: 'abeh', parentId: this.folders.abe.id},
					{name: 'abi', parentId: this.folders.ab.id}
				]);
			});

			it('sets hierarchyLevel for all rows', async function() {
				const folder = await findOne(this.folder, {where: {name: 'abeh'}});
				expect(folder.hierarchyLevel).to.equal(4);

				const folder2 = await findOne(this.folder, {where: {name: 'abi'}});
				expect(folder2.hierarchyLevel).to.equal(3);
			});

			it('creates hierarchy table records for all rows', async function() {
				const folder = await findOne(this.folder, {
					where: {name: 'abeh'},
					include: [{model: this.folder, as: 'ancestors'}],
					order: [[{model: this.folder, as: 'ancestors'}, 'hierarchyLevel']]
				});

				const {ancestors} = folder;
				expect(ancestors.length).to.equal(3);
				expect(ancestors[0].id).to.equal(this.folders.a.id);
				expect(ancestors[1].id).to.equal(this.folders.ab.id);
				expect(ancestors[2].id).to.equal(this.folders.abe.id);

				const folder2 = await findOne(this.folder, {
					where: {name: 'abi'},
					include: [{model: this.folder, as: 'ancestors'}],
					order: [[{model: this.folder, as: 'ancestors'}, 'hierarchyLevel']]
				});

				const ancestors2 = folder2.ancestors;
				expect(ancestors2.length).to.equal(2);
				expect(ancestors2[0].id).to.equal(this.folders.a.id);
				expect(ancestors2[1].id).to.equal(this.folders.ab.id);
			});
		});

		describe('#bulkUpdate', () => {
			beforeEach(async function() {
				await this.folder.update(
					{parentId: this.folders.ab.id},
					{where: {parentId: this.folders.abd.id}}
				);
			});

			it('sets hierarchyLevel for all rows', async function() {
				for (const name of ['abdf', 'abdg']) {
					const folder = await findOne(this.folder, {where: {name}});
					expect(folder.hierarchyLevel).to.equal(3);
				}
			});

			it('creates hierarchy table records for all rows', async function() {
				for (const name of ['abdf', 'abdg']) {
					const folder = await findOne(this.folder, {
						where: {name},
						include: [{model: this.folder, as: 'ancestors'}],
						order: [[{model: this.folder, as: 'ancestors'}, 'hierarchyLevel']]
					});
					const {ancestors} = folder;
					expect(ancestors.length).to.equal(2);
					expect(ancestors[0].id).to.equal(this.folders.a.id);
					expect(ancestors[1].id).to.equal(this.folders.ab.id);
				}
			});
		});

		describe('#bulkDestroy', () => {
			it('removes hierarchy table records for all rows', async function() {
				await this.folder.destroy({where: {parentId: this.folders.abd.id}});

				for (const name of ['abdf', 'abdg']) {
					const ancestors = await this.folderAncestor.findAll({
						where: {folderId: this.folders[name].id}
					});
					expect(ancestors.length).to.equal(0);
				}
			});

			it('throws error if try to destroy a record which has children', async function() {
				const promise = this.folder.destroy({where: {parentId: this.folders.ab.id}});
				await expect(promise).to.be.rejectedWith(Sequelize.ForeignKeyConstraintError);
			});
		});

		describe('#find', () => {
			describe('can retrieve', () => {
				it('children', async function() {
					const folder = await findOne(this.folder, {
						where: {name: 'a'},
						include: [{model: this.folder, as: 'children'}],
						order: [[{model: this.folder, as: 'children'}, 'name']]
					});

					expect(folder.children.length).to.equal(2);
					expect(folder.children[0].name).to.equal('ab');
					expect(folder.children[1].name).to.equal('ac');
				});

				it('descendents', async function() {
					const folder = await findOne(this.folder, {
						where: {name: 'a'},
						include: [{model: this.folder, as: 'descendents'}],
						order: [[{model: this.folder, as: 'descendents'}, 'name']]
					});

					expect(folder.descendents.length).to.equal(6);
					expect(folder.descendents[0].name).to.equal('ab');
					expect(folder.descendents[1].name).to.equal('abd');
					expect(folder.descendents[2].name).to.equal('abdf');
					expect(folder.descendents[3].name).to.equal('abdg');
					expect(folder.descendents[4].name).to.equal('abe');
					expect(folder.descendents[5].name).to.equal('ac');
				});

				it('parent', async function() {
					const folder = await findOne(this.folder, {
						where: {name: 'abdf'},
						include: [{model: this.folder, as: 'parent'}]
					});

					expect(folder.parent).to.be.ok;
					expect(folder.parent.name).to.equal('abd');
				});

				it('ancestors', async function() {
					const folder = await findOne(this.folder, {
						where: {name: 'abdf'},
						include: [{model: this.folder, as: 'ancestors'}],
						order: [[{model: this.folder, as: 'ancestors'}, 'hierarchyLevel']]
					});

					expect(folder.ancestors.length).to.equal(3);
					expect(folder.ancestors[0].name).to.equal('a');
					expect(folder.ancestors[1].name).to.equal('ab');
					expect(folder.ancestors[2].name).to.equal('abd');
				});

				it('other associations', async function() {
					const folder = await findOne(this.folder, {
						where: {name: 'abdf'},
						include: this.drive
					});

					expect(folder.drive).to.be.ok;
					expect(folder.drive.name).to.equal(this.drives.a.name);
				});
			});

			describe('with hierarchy option', () => {
				it('findAll gets a structured tree', async function() {
					const folders = await this.folder.findAll({order: [['name']], hierarchy: true});

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

				it('find gets a structured tree', async function() {
					const folder = await findOne(this.folder, {
						where: {name: 'a'},
						include: [{model: this.folder, as: 'descendents', hierarchy: true}],
						order: [[{model: this.folder, as: 'descendents'}, 'name']]
					});

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

				it('find gets a structured tree when included from another model', async function() {
					const drives = await this.drive.findAll({
						include: {
							model: this.folder,
							where: {name: 'a'},
							include: {model: this.folder, as: 'descendents', hierarchy: true}
						},
						order: [[{model: this.folder}, {model: this.folder, as: 'descendents'}, 'name']]
					});

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

				it('find gets a structured tree when included from another model 2 deep', async function() {
					const folder = await findOne(this.folder, {
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
					});

					expect(folder.name).to.equal('a');

					const {drive} = folder;
					expect(drive.folders).to.be.ok;
					expect(drive.folders.length).to.equal(1);

					const driveFolder = drive.folders[0];

					expect(driveFolder.name).to.equal('a');
					expect(driveFolder.children).to.exist;
					expect(driveFolder.children.length).to.equal(2);
					expect(driveFolder.children[0].name).to.equal('ab');
					expect(driveFolder.children[1].name).to.equal('ac');

					expect(driveFolder.children[0].children).to.exist;
					expect(driveFolder.children[0].children.length).to.equal(2);
					expect(driveFolder.children[0].children[0].name).to.equal('abd');
					expect(driveFolder.children[0].children[1].name).to.equal('abe');

					expect(driveFolder.children[1].children).not.to.exist;

					expect(driveFolder.children[0].children[0].children).to.exist;
					expect(driveFolder.children[0].children[0].children.length).to.equal(2);
					expect(driveFolder.children[0].children[0].children[0].name).to.equal('abdf');
					expect(driveFolder.children[0].children[0].children[1].name).to.equal('abdg');

					expect(driveFolder.children[0].children[1].children).not.to.exist;

					expect(driveFolder.children[0].children[0].children[0].children).not.to.exist;
					expect(driveFolder.children[0].children[0].children[1].children).not.to.exist;
				});

				it('works with `raw` option', async function() {
					const folders = await this.folder.findAll({
						order: [['name']],
						hierarchy: true,
						raw: true
					});

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

			describe('works with scoped models', () => {
				beforeEach(function() {
					this.scopedFolder = this.folder.scope('withDrive');
				});

				it('with main model scoped', async function() {
					const folder = await findOne(this.scopedFolder, {
						where: {name: 'a'},
						include: [{model: this.folder, as: 'descendents', hierarchy: true}],
						order: [[{model: this.folder, as: 'descendents'}, 'name']]
					});

					expect(folder.drive).to.be.ok;
					expect(folder.drive.name).to.equal(this.drives.a.name);

					for (const params of [
						{folder: folder.children[0], name: 'ab', numChildren: 2},
						{folder: folder.children[0].children[0], name: 'abd', numChildren: 2},
						{folder: folder.children[0].children[0].children[0], name: 'abdf'},
						{folder: folder.children[0].children[0].children[1], name: 'abdg'},
						{folder: folder.children[0].children[1], name: 'abe'},
						{folder: folder.children[1], name: 'ac'}
					]) {
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
					}
				});

				it('with hierarchy model scoped', async function() {
					const folder = await findOne(this.folder, {
						where: {name: 'a'},
						include: [{model: this.scopedFolder, as: 'descendents', hierarchy: true}],
						order: [[{model: this.scopedFolder, as: 'descendents'}, 'name']]
					});

					expect(folder.drive).to.be.undefined;

					for (const params of [
						{folder: folder.children[0], name: 'ab', numChildren: 2},
						{folder: folder.children[0].children[0], name: 'abd', numChildren: 2},
						{folder: folder.children[0].children[0].children[0], name: 'abdf'},
						{folder: folder.children[0].children[0].children[1], name: 'abdg'},
						{folder: folder.children[0].children[1], name: 'abe'},
						{folder: folder.children[1], name: 'ac'}
					]) {
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
					}
				});

				it('with both models scoped', async function() {
					const folder = await findOne(this.scopedFolder, {
						where: {name: 'a'},
						include: [{model: this.scopedFolder, as: 'descendents', hierarchy: true}],
						order: [[{model: this.scopedFolder, as: 'descendents'}, 'name']]
					});

					expect(folder.drive).to.be.ok;
					expect(folder.drive.name).to.equal(this.drives.a.name);

					for (const params of [
						{folder: folder.children[0], name: 'ab', numChildren: 2},
						{folder: folder.children[0].children[0], name: 'abd', numChildren: 2},
						{folder: folder.children[0].children[0].children[0], name: 'abdf'},
						{folder: folder.children[0].children[0].children[1], name: 'abdg'},
						{folder: folder.children[0].children[1], name: 'abe'},
						{folder: folder.children[1], name: 'ac'}
					]) {
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
					}
				});
			});

			describe('handles empty result set with', () => {
				it('#find', async function() {
					const folder = await findOne(this.folder, {where: {name: 'z'}});
					expect(folder).to.be.null;
				});

				it('#findAll', async function() {
					const folders = await this.folder.findAll({where: {name: 'z'}});
					expect(folders.length).to.equal(0);
				});

				it('#find with an include', async function() {
					const folder = await findOne(this.folder, {
						where: {name: 'z'},
						include: [{model: this.folder, as: 'parent'}]
					});
					expect(folder).to.be.null;
				});

				it('#find with an empty include', async function() {
					const folder = await findOne(this.folder, {
						where: {name: 'a'},
						include: [{model: this.folder, as: 'parent'}]
					});
					expect(folder.parent).to.be.null;
				});

				it('#find with empty descendents', async function() {
					const folder = await findOne(this.folder, {
						where: {name: 'abdg'},
						include: [{model: this.folder, as: 'descendents', hierarchy: true}]
					});
					expect(folder.children.length).to.equal(0);
				});
			});
		});

		describe('accessors', () => {
			describe('can retrieve', () => {
				it('children', async function() {
					const folders = await this.folders.a.getChildren({order: [['name']]});
					expect(folders.length).to.equal(2);
					expect(folders[0].name).to.equal('ab');
					expect(folders[1].name).to.equal('ac');
				});

				it('descendents', async function() {
					const folders = await this.folders.a.getDescendents({order: [['name']]});
					expect(folders.length).to.equal(6);
					expect(folders[0].name).to.equal('ab');
					expect(folders[1].name).to.equal('abd');
					expect(folders[2].name).to.equal('abdf');
					expect(folders[3].name).to.equal('abdg');
					expect(folders[4].name).to.equal('abe');
					expect(folders[5].name).to.equal('ac');
				});

				it('parent', async function() {
					const folder = await this.folders.abdf.getParent();
					expect(folder).to.be.ok;
					expect(folder.name).to.equal('abd');
				});

				it('ancestors', async function() {
					const folders = await this.folders.abdf.getAncestors({order: [['hierarchyLevel']]});
					expect(folders.length).to.equal(3);
					expect(folders[0].name).to.equal('a');
					expect(folders[1].name).to.equal('ab');
					expect(folders[2].name).to.equal('abd');
				});
			});

			describe('with hierarchy option', () => {
				it('getDescendents gets a structured tree', async function() {
					const folders = await this.folders.a.getDescendents({
						order: [['name']],
						hierarchy: true
					});

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

		describe('setters', () => {
			describe('legal', () => {
				it('setParent', async function() {
					await this.folders.abdg.setParent(this.folders.a);
					const folder = await findOne(this.folder, {where: {name: 'abdg'}});
					expect(folder.parentId).to.equal(this.folders.a.id);
					expect(folder.hierarchyLevel).to.equal(2);
				});

				describe('createParent', () => {
					beforeEach(async function() {
						await this.folders.abd.createParent({
							name: 'ach',
							parentId: this.folders.ac.id
						});
						this.folders.ach = await findOne(this.folder, {where: {name: 'ach'}});
					});

					describe('creates new item', () => {
						it('with correct parent', function() {
							expect(this.folders.ach.parentId).to.equal(this.folders.ac.id);
						});

						it('with correct hierarchyLevel', function() {
							expect(this.folders.ach.hierarchyLevel).to.equal(3);
						});

						it('with correct hierarchy table entries', async function() {
							const ancestors = await this.folderAncestor.findAll({
								where: {folderId: this.folders.ach.id},
								order: [['ancestorId']]
							});
							expect(ancestors.length).to.equal(2);
							expect(ancestors[0].ancestorId).to.equal(this.folders.a.id);
							expect(ancestors[1].ancestorId).to.equal(this.folders.ac.id);
						});
					});

					describe('sets current item', () => {
						it('to correct parent', async function() {
							const folder = await findOne(this.folder, {where: {name: 'abd'}});
							expect(folder.parentId).to.equal(this.folders.ach.id);
						});

						it('with correct hierarchyLevel', async function() {
							const folder = await findOne(this.folder, {where: {name: 'abd'}});
							expect(folder.hierarchyLevel).to.equal(4);
						});

						it('with correct hierarchy table entries', async function() {
							const ancestors = await this.folderAncestor.findAll({
								where: {folderId: this.folders.abd.id},
								order: [['ancestorId']]
							});

							expect(ancestors.length).to.equal(3);
							expect(ancestors[0].ancestorId).to.equal(this.folders.a.id);
							expect(ancestors[1].ancestorId).to.equal(this.folders.ac.id);
							expect(ancestors[2].ancestorId).to.equal(this.folders.ach.id);
						});
					});
				});

				it('addChild', async function() {
					await this.folders.a.addChild(this.folders.abdg);
					const folder = await findOne(this.folder, {where: {name: 'abdg'}});
					expect(folder.parentId).to.equal(this.folders.a.id);
					expect(folder.hierarchyLevel).to.equal(2);
				});

				describe('createChild', () => {
					beforeEach(async function() {
						await this.folders.ac.createChild({name: 'ach'});
						const folder = await findOne(this.folder, {where: {name: 'ach'}});
						this.folders.ach = folder;
					});

					it('with correct parent', function() {
						expect(this.folders.ach.parentId).to.equal(this.folders.ac.id);
					});

					it('with correct hierarchyLevel', function() {
						expect(this.folders.ach.hierarchyLevel).to.equal(3);
					});

					it('with correct hierarchy table entries', async function() {
						const ancestors = await this.folderAncestor.findAll({
							where: {folderId: this.folders.ach.id},
							order: [['ancestorId']]
						});
						expect(ancestors.length).to.equal(2);
						expect(ancestors[0].ancestorId).to.equal(this.folders.a.id);
						expect(ancestors[1].ancestorId).to.equal(this.folders.ac.id);
					});
				});
			});

			describe('illegal methods not present', () => {
				for (const params of [
					{accessor: 'set', plural: true},
					{accessor: 'add'},
					{accessor: 'add', plural: true},
					{accessor: 'create'},
					{accessor: 'remove'},
					{accessor: 'remove', plural: true}
				]) {
					let accessor = `${params.accessor}${params.plural ? 'Descendents' : 'Descendent'}`;
					it(accessor, function() {
						expect(this.folders.ac[accessor]).to.be.undefined;
					});

					accessor = `${params.accessor}${params.plural ? 'Ancestors' : 'Ancestor'}`;
					it(accessor, function() {
						expect(this.folders.ac[accessor]).to.be.undefined;
					});
				}
			});
		});

		describe('#rebuildHierarchy', () => {
			beforeEach(async function() {
				await this.folderAncestor.destroy({where: {}});
				await this.folder.update({hierarchyLevel: 999}, {where: {}});
				await this.folder.rebuildHierarchy();
			});

			it('recreates hierarchyLevel for all records', async function() {
				const folders = await this.folder.findAll();

				for (const folder of folders) {
					expect(folder.hierarchyLevel).to.equal(folder.name.length);
				}
			});

			it('recreates hierarchy table records', async function() {
				const descendents = await this.folderAncestor.findAll({
					where: {ancestorId: this.folders.a.id},
					order: [['folderId']]
				});

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

	describe('Options', () => {
		describe('underscored', () => {
			it('underscores field names and foreign keys', function() {
				const folder = this.sequelize.define(
					'folder',
					{name: Sequelize.STRING},
					{underscored: true}
				);

				folder.isHierarchy();

				expect(attributes(folder)).to.have.property('hierarchy_level');
				expect(attributes(folder)).to.have.property('parent_id');
				const throughModel = folder.associations.ancestors.through.model;
				expect(attributes(throughModel)).to.have.property('folder_id');
				expect(attributes(throughModel)).to.have.property('ancestor_id');
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

				expect(attributes(folder)).to.have.property('testFieldName');
				expect(attributes(folder)).to.have.property('testForeignKey');
				const throughModel = folder.associations.ancestors.through.model;
				expect(attributes(throughModel)).to.have.property('testThroughForeignKey');
				expect(attributes(throughModel)).to.have.property('testThroughKey');
				expect(folder.associations.ancestors.foreignKey).to.equal('testThroughKey');
				expect(folder.associations.children.foreignKey).to.equal('testForeignKey');
				expect(throughModel.tableName).to.equal('foldersancestors');
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

		describe('onDelete: CASCADE', () => {
			it('deletes all children', async function() {
				const {sequelize} = this;
				const folder = sequelize.define('folder', {
					name: Sequelize.STRING
				});
				folder.isHierarchy({camelThrough: true, onDelete: 'CASCADE'});

				await sequelize.sync({force: true});

				// Created nested folders
				const folders = {};
				for (const folderParams of [
					{name: 'a', parentName: null},
					{name: 'ab', parentName: 'a'},
					{name: 'ac', parentName: 'a'},
					{name: 'abd', parentName: 'ab'}
				]) {
					const parent = folders[folderParams.parentName];
					folderParams.parentId = parent ? parent.id : null;
					delete folderParams.parentName;
					folders[folderParams.name] = await folder.create(folderParams);
				}

				// Delete root folder
				await folder.destroy({where: {id: folders.a.id}});

				const folderRecords = await folder.findAll();
				expect(folderRecords.length).to.equal(0);

				const ancestorRecords = await sequelize.models.folderAncestor.findAll();
				expect(ancestorRecords.length).to.equal(0);
			});
		});
	});
}
