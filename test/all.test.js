// --------------------
// Sequelize hierarchy
// Tests
// --------------------

// modules
var chai = require('chai'),
	expect = chai.expect,
	promised = require('chai-as-promised'),
	Sequelize = require('sequelize'),
	Support = require(__dirname + '/support'),
	Promise = Sequelize.Promise;

require('../lib/')(Sequelize);

// init

chai.use(promised);
chai.config.includeStack = true;

// tests

describe(Support.getTestDialectTeaser("Tests"), function () {
	describe('Hierarchy creation', function() {
		it('works via isHierarchy()', function() {
			var folder = this.sequelize.define('folder', {
				name: Sequelize.STRING
			});
			
			folder.isHierarchy();
			
			expect(folder.hierarchy).to.be.ok;
		});
		
		it('works via define options', function() {
			var folder = this.sequelize.define('folder', {
				name: Sequelize.STRING
			}, {
				hierarchy: true
			});
			
			expect(folder.hierarchy).to.be.ok;
		});
		
		it('allows parentId and hierarchyLevel fields to already be defined', function() {
			var folder = this.sequelize.define('folder', {
				name: Sequelize.STRING,
				hierarchyLevel: Sequelize.INTEGER,
				parentId: Sequelize.INTEGER
			});
			
			folder.isHierarchy();
			
			expect(folder.attributes.hierarchyLevel.type._unsigned).to.equal(true);
			expect(folder.attributes.parentId.references).to.equal('folders');
		});
	});
	
	describe('Methods', function() {
		beforeEach(function() {
			this.folder = this.sequelize.define('folder', {
				name: Sequelize.STRING
			});
			
			this.folder.isHierarchy();
			
			this.folderAncestor = this.sequelize.models.folderAncestor;
			
			this.drive = this.sequelize.define('drive', {
				name: Sequelize.STRING
			});
			
			this.drive.hasMany(this.folder);
			this.folder.belongsTo(this.drive);
			
			return this.sequelize.sync({ force: true }).bind(this)
			.then(function() {
				this.folders = {};
				
				return Promise.each([
					{name: 'a', parentName: null},
					{name: 'ab', parentName: 'a'},
					{name: 'ac', parentName: 'a'},
					{name: 'abd', parentName: 'ab'},
					{name: 'abe', parentName: 'ab'},
					{name: 'abdf', parentName: 'abd'},
					{name: 'abdg', parentName: 'abd'}
				], function(folderParams) {
					// get parent
					var parent = this.folders[folderParams.parentName];
					folderParams.parentId = parent ? parent.id : null;
					
					return this.folder.create({name: folderParams.name, parentId: folderParams.parentId}).bind(this)
					.then(function(folder) {
						this.folders[folder.name] = folder;
					});
				}.bind(this));
			});
		});
		
		describe('#create', function() {
			describe('for root level', function() {
				it('sets hierarchyLevel', function() {
					return this.folder.find({where: {name: 'a'}})
					.then(function(folder) {
						expect(folder.hierarchyLevel).to.equal(1);
					});
				});
				
				it('creates hierarchy table records', function() {
					return this.folderAncestor.findAll({where: {folderId: this.folders.a.id}}).bind(this)
					.then(function(ancestors) {
						expect(ancestors.length).to.equal(0);
					});
				});
			});
			
			describe('for 2nd level', function() {		
				it('sets hierarchyLevel', function() {
					return this.folder.find({where: {name: 'ab'}})
					.then(function(folder) {
						expect(folder.hierarchyLevel).to.equal(2);
					});
				});
				
				it('creates hierarchy table records', function() {
					return this.folderAncestor.findAll({where: {folderId: this.folders.ab.id}}).bind(this)
					.then(function(ancestors) {
						expect(ancestors.length).to.equal(1);
						expect(ancestors[0].ancestorId).to.equal(this.folders.a.id);
					});
				});
			});
			
			describe('for 3rd level', function() {		
				it('sets hierarchyLevel', function() {
					return this.folder.find({where: {name: 'abd'}})
					.then(function(folder) {
						expect(folder.hierarchyLevel).to.equal(3);
					});
				});
				
				it('creates hierarchy table records', function() {
					return this.folderAncestor.findAll({where: {folderId: this.folders.abd.id}, order: [['ancestorId']]}).bind(this)
					.then(function(ancestors) {
						expect(ancestors.length).to.equal(2);
						expect(ancestors[0].ancestorId).to.equal(this.folders.a.id);
						expect(ancestors[1].ancestorId).to.equal(this.folders.ab.id);
					});
				});
			});
		});
		
		describe('#updateAttributes', function() {
			describe('for root level', function() {
				beforeEach(function() {
					return this.folders.abdf.updateAttributes({parentId: null});
				});
				
				it('sets hierarchyLevel', function() {
					return this.folder.find({where: {name: 'abdf'}})
					.then(function(folder) {
						expect(folder.hierarchyLevel).to.equal(1);
					});
				});
				
				it('updates hierarchy table records', function() {
					return this.folderAncestor.findAll({where: {folderId: this.folders.abdf.id}}).bind(this)
					.then(function(ancestors) {
						expect(ancestors.length).to.equal(0);
					});
				});
			});
			
			describe('for 2nd level', function() {
				beforeEach(function() {
					return this.folders.abdf.updateAttributes({parentId: this.folders.a.id});
				});
				
				it('sets hierarchyLevel', function() {
					return this.folder.find({where: {name: 'abdf'}})
					.then(function(folder) {
						expect(folder.hierarchyLevel).to.equal(2);
					});
				});
				
				it('updates hierarchy table records', function() {
					return this.folderAncestor.findAll({where: {folderId: this.folders.abdf.id}}).bind(this)
					.then(function(ancestors) {
						expect(ancestors.length).to.equal(1);
						expect(ancestors[0].ancestorId).to.equal(this.folders.a.id);
					});
				});
			});
			
			describe('for 3rd level', function() {
				beforeEach(function() {
					return this.folders.abdf.updateAttributes({parentId: this.folders.ab.id});
				});
				
				it('sets hierarchyLevel', function() {
					return this.folder.find({where: {name: 'abdf'}})
					.then(function(folder) {
						expect(folder.hierarchyLevel).to.equal(3);
					});
				});
				
				it('updates hierarchy table records', function() {
					return this.folderAncestor.findAll({where: {folderId: this.folders.abdf.id}, order: [['ancestorId']]}).bind(this)
					.then(function(ancestors) {
						expect(ancestors.length).to.equal(2);
						expect(ancestors[0].ancestorId).to.equal(this.folders.a.id);
						expect(ancestors[1].ancestorId).to.equal(this.folders.ab.id);
					});
				});
			});
			
			describe('descendents', function() {
				beforeEach(function() {
					return this.folders.ab.updateAttributes({parentId: this.folders.ac.id});
				});
				
				it('sets hierarchyLevel for descendents', function() {
					return this.folder.find({where: {name: 'abdf'}})
					.then(function(folder) {
						expect(folder.hierarchyLevel).to.equal(5);
					});
				});
				
				it('updates hierarchy table records for descendents', function() {
					return this.folder.find({
						where: {id: this.folders.abdf.id},
						include: [{model: this.folder, as: 'ancestors'}],
						order: [[{model: this.folder, as: 'ancestors'}, 'hierarchyLevel']]
					}).bind(this)
					.then(function(folder) {
						var ancestors = folder.ancestors;
						expect(ancestors.length).to.equal(4);
						expect(ancestors[0].id).to.equal(this.folders.a.id);
						expect(ancestors[1].id).to.equal(this.folders.ac.id);
						expect(ancestors[2].id).to.equal(this.folders.ab.id);
						expect(ancestors[3].id).to.equal(this.folders.abd.id);
					});
				});
			});
			
			describe('errors', function() {
				it('throws error if trying to make parent one of descendents', function() {
					var promise = this.folders.a.updateAttributes({parentId: this.folders.ab.id});
					return expect(promise).to.be.rejected;
				});
			});
		});
		
		describe('#destroy', function() {
			it('removes hierarchy table records', function() {
				return this.folders.abdf.destroy().bind(this)
				.then(function() {
					return this.folderAncestor.findAll({where: {folderId: this.folders.abdf.id}}).bind(this)
					.then(function(ancestors) {
						expect(ancestors.length).to.equal(0);
					});
				});
			});
			
			it('throws error if try to destroy a record which has children', function() {
				var promise = this.folders.a.destroy();
				return expect(promise).to.be.rejected;
			});
		});
		
		describe('#bulkCreate', function() {
			beforeEach(function() {
				return this.folder.bulkCreate([
					{name: 'abeh', parentId: this.folders.abe.id},
					{name: 'abi', parentId: this.folders.ab.id}
				]);
			});
			
			it('sets hierarchyLevel for all rows', function() {
				return this.folder.find({where: {name: 'abeh'}}).bind(this)
				.then(function(folder) {
					expect(folder.hierarchyLevel).to.equal(4);
					
					return this.folder.find({where: {name: 'abi'}});
				})
				.then(function(folder) {
					expect(folder.hierarchyLevel).to.equal(3);
				});
			});
			
			it('creates hierarchy table records for all rows', function() {
				return this.folder.find({
					where: {name: 'abeh'},
					include: [{model: this.folder, as: 'ancestors'}],
					order: [[{model: this.folder, as: 'ancestors'}, 'hierarchyLevel']]
				}).bind(this)
				.then(function(folder) {
					var ancestors = folder.ancestors;
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
				.then(function(folder) {
					var ancestors = folder.ancestors;
					expect(ancestors.length).to.equal(2);
					expect(ancestors[0].id).to.equal(this.folders.a.id);
					expect(ancestors[1].id).to.equal(this.folders.ab.id);
				});
			});
		});
		
		describe('#bulkUpdate', function() {
			beforeEach(function() {
				return this.folder.update({parentId: this.folders.ab.id}, {where: {parentId: this.folders.abd.id}});
			});
			
			it('sets hierarchyLevel for all rows', function() {
				return Promise.each(['abdf', 'abdg'], function(name) {
					return this.folder.find({where: {name: name}}).bind(this)
					.then(function(folder) {
						expect(folder.hierarchyLevel).to.equal(3);
					});
				}.bind(this));
			});
			
			it('creates hierarchy table records for all rows', function() {
				return Promise.each(['abdf', 'abdg'], function(name) {
					return this.folder.find({
						where: {name: name},
						include: [{model: this.folder, as: 'ancestors'}],
						order: [[{model: this.folder, as: 'ancestors'}, 'hierarchyLevel']]
					}).bind(this)
					.then(function(folder) {
						var ancestors = folder.ancestors;
						expect(ancestors.length).to.equal(2);
						expect(ancestors[0].id).to.equal(this.folders.a.id);
						expect(ancestors[1].id).to.equal(this.folders.ab.id);
					});
				}.bind(this));
			});
		});
		
		describe('#bulkDestroy', function() {
			it('removes hierarchy table records for all rows', function() {
				return this.folder.destroy({where: {parentId: this.folders.abd.id}}).bind(this)
				.then(function() {
					return Promise.each(['abdf', 'abdg'], function(name) {
						return this.folderAncestor.findAll({where: {folderId: this.folders[name].id}}).bind(this)
						.then(function(ancestors) {
							expect(ancestors.length).to.equal(0);
						});
					}.bind(this));
				});
			});
			
			it('throws error if try to destroy a record which has children', function() {
				var promise = this.folder.destroy({where: {parentId: this.folders.ab.id}}).bind(this)
				return expect(promise).to.be.rejected;
			});
		});
		
		describe('#find', function() {
			describe('can retrieve', function() {
				it('children', function() {
					return this.folder.find({
						where: {name: 'a'},
						include: [{model: this.folder, as: 'children'}],
						order: [[{model: this.folder, as: 'children'}, 'name']]
					}).bind(this)
					.then(function(folder) {
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
					}).bind(this)
					.then(function(folder) {
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
					}).bind(this)
					.then(function(folder) {
						expect(folder.parent).to.be.ok;
						expect(folder.parent.name).to.equal('abd');
					});
				});
				
				it('ancestors', function() {
					return this.folder.find({
						where: {name: 'abdf'},
						include: [{model: this.folder, as: 'ancestors'}],
						order: [[{model: this.folder, as: 'ancestors'}, 'hierarchyLevel']]
					}).bind(this)
					.then(function(folder) {
						expect(folder.ancestors.length).to.equal(3);
						expect(folder.ancestors[0].name).to.equal('a');
						expect(folder.ancestors[1].name).to.equal('ab');
						expect(folder.ancestors[2].name).to.equal('abd');
					});
				});
			});
			
			describe('with hierarchy option', function() {
				it('findAll gets a structured tree', function() {
					return this.folder.findAll({order: [['name']], hierarchy: true}).bind(this)
					.then(function(folders) {
						expect(folders.length).to.equal(1);
						var folder = folders[0];
						
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
					}).bind(this)
					.then(function(folder) {
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
					return this.drive.create({name: 'x'}).bind(this)
					.then(function(drive) {
						this.drives = {x: drive};
						return drive.addFolder(this.folders.a);
					})
					.then(function() {
						return this.drive.findAll({
							include: {
								model: this.folder, 
								include: {model: this.folder, as: 'descendents', hierarchy: true}
							}
						});
					})
					.then(function(drives) {
						expect(drives.length).to.equal(1);
						expect(drives[0].folders).to.be.ok;
						expect(drives[0].folders.length).to.equal(1);
						
						var folder = drives[0].folders[0];
						
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
		});
		
		describe('accessors', function() {
			describe('can retrieve', function() {
				it('children', function() {
					return this.folders.a.getChildren({order: [['name']]}).bind(this)
					.then(function(folders) {
						expect(folders.length).to.equal(2);
						expect(folders[0].name).to.equal('ab');
						expect(folders[1].name).to.equal('ac');
					});
				});
				
				it('descendents', function() {
					return this.folders.a.getDescendents({order: [['name']]}).bind(this)
					.then(function(folders) {
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
					return this.folders.abdf.getParent().bind(this)
					.then(function(folder) {
						expect(folder).to.be.ok;
						expect(folder.name).to.equal('abd');
					});
				});
				
				it('ancestors', function() {
					return this.folders.abdf.getAncestors({order: [['hierarchyLevel']]}).bind(this)
					.then(function(folders) {
						expect(folders.length).to.equal(3);
						expect(folders[0].name).to.equal('a');
						expect(folders[1].name).to.equal('ab');
						expect(folders[2].name).to.equal('abd');
					});
				});
			});
			
			describe('with hierarchy option', function() {
				it('getDescendents gets a structured tree', function() {
					return this.folders.a.getDescendents({order: [['name']], hierarchy: true}).bind(this)
					.then(function(folders) {
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
		
		describe('setters', function() {
			describe('legal', function() {
				it('setParent', function() {
					return this.folders.abdg.setParent(this.folders.a).bind(this)
					.then(function() {
						return this.folder.find({where: {name: 'abdg'}});
					}).then(function(folder) {
						expect(folder.parentId).to.equal(this.folders.a.id);
						expect(folder.hierarchyLevel).to.equal(2);
					});
				});
				
				describe('createParent', function() {
					beforeEach(function() {
						return this.folders.abd.createParent({name: 'ach', parentId: this.folders.ac.id}).bind(this)
						.then(function() {
							return this.folder.find({where: {name: 'ach'}}).bind(this)
							.then(function(folder) {
								this.folders.ach = folder;
							});
						});
					});
					
					describe('creates new item', function() {
						it('with correct parent', function() {
							expect(this.folders.ach.parentId).to.equal(this.folders.ac.id);
						});
						
						it('with correct hierarchyLevel', function() {
							expect(this.folders.ach.hierarchyLevel).to.equal(3);
						});
						
						it('with correct hierarchy table entries', function() {
							return this.folderAncestor.findAll({where: {folderId: this.folders.ach.id}, order: [['ancestorId']]}).bind(this)
							.then(function(ancestors) {
								expect(ancestors.length).to.equal(2);
								expect(ancestors[0].ancestorId).to.equal(this.folders.a.id);
								expect(ancestors[1].ancestorId).to.equal(this.folders.ac.id);
							});
						});
					});
					
					describe('sets current item', function() {
						it('to correct parent', function() {
							return this.folder.find({where: {name: 'abd'}}).bind(this)
							.then(function(folder) {
								expect(folder.parentId).to.equal(this.folders.ach.id);
							});
						});
						
						it('with correct hierarchyLevel', function() {
							return this.folder.find({where: {name: 'abd'}}).bind(this)
							.then(function(folder) {
								expect(folder.hierarchyLevel).to.equal(4);
							});
						});
						
						it('with correct hierarchy table entries', function() {
							return this.folderAncestor.findAll({where: {folderId: this.folders.abd.id}, order: [['ancestorId']]}).bind(this)
							.then(function(ancestors) {
								expect(ancestors.length).to.equal(3);
								expect(ancestors[0].ancestorId).to.equal(this.folders.a.id);
								expect(ancestors[1].ancestorId).to.equal(this.folders.ac.id);
								expect(ancestors[2].ancestorId).to.equal(this.folders.ach.id);
							});
						});
					});
				});
				
				it('addChild', function() {
					return this.folders.a.addChild(this.folders.abdg).bind(this)
					.then(function() {
						return this.folder.find({where: {name: 'abdg'}});
					}).then(function(folder) {
						expect(folder.parentId).to.equal(this.folders.a.id);
						expect(folder.hierarchyLevel).to.equal(2);
					});
				});
				
				describe('createChild', function() {
					beforeEach(function() {
						return this.folders.ac.createChild({name: 'ach'}).bind(this)
						.then(function() {
							return this.folder.find({where: {name: 'ach'}});
						}).then(function(folder) {
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
						return this.folderAncestor.findAll({where: {folderId: this.folders.ach.id}, order: [['ancestorId']]}).bind(this)
						.then(function(ancestors) {
							expect(ancestors.length).to.equal(2);
							expect(ancestors[0].ancestorId).to.equal(this.folders.a.id);
							expect(ancestors[1].ancestorId).to.equal(this.folders.ac.id);
						});
					});
				});
			});
			
			describe('illegal throws error', function() {
				['set', 'add', 'addMultiple', 'create', 'remove'].forEach(function(accessorType) {
					it(accessorType + 'Descendent', function() {
						var promise = Promise.try(function() {this.folders.ac[accessorType + 'Descendent'](this.folders.abdg);});
						return expect(promise).to.be.rejected;
					});
					
					it(accessorType + 'Ancestor', function() {
						var promise = Promise.try(function() {this.folders.ac[accessorType + 'Ancestor'](this.folders.abdg);});
						return expect(promise).to.be.rejected;
					});
				}.bind(this));
			});
		});
		
		describe('#rebuildHierarchy', function() {
			beforeEach(function() {
				return this.folderAncestor.destroy({}, {truncate: true}).bind(this)
				.then(function() {
					return this.folder.update({hierarchyLevel: 999}, {where: {}});
				})
				.then(function() {
					return this.folder.rebuildHierarchy();
				});
			});
			
			it('recreates hierarchyLevel for all records', function() {
				return this.folder.findAll().bind(this)
				.then(function(folders) {
					folders.forEach(function(folder) {
						expect(folder.hierarchyLevel).to.equal(folder.name.length);
					});
				});
			});
			
			it('recreates hierarchy table records', function() {
				return this.folderAncestor.findAll({where: {ancestorId: this.folders.a.id}, order: [['folderId']]}).bind(this)
				.then(function(descendents) {
					expect(descendents.length).to.equal(6);
					expect(descendents[0].folderId).to.equal(this.folders.ab.id);
					expect(descendents[1].folderId).to.equal(this.folders.ac.id);
					expect(descendents[2].folderId).to.equal(this.folders.abd.id);
					expect(descendents[3].folderId).to.equal(this.folders.abe.id);
					expect(descendents[4].folderId).to.equal(this.folders.abdf.id);
					expect(descendents[5].folderId).to.equal(this.folders.abdg.id);
				});
			});
		});
	});
});
