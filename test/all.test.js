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

require('../lib/index')(Sequelize);

// init

chai.use(promised);
chai.config.includeStack = true;

// tests

describe(Support.getTestDialectTeaser("Tests"), function () {
	beforeEach(function() {
		this.folder = this.sequelize.define('folder', {
			name: Sequelize.STRING
		});
		
		this.folder.isHierarchy();
		
		this.foldersAncestor = this.sequelize.models.foldersAncestors;
		
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
			it('should set hierarchyLevel', function() {
				return this.folder.find({where: {name: 'a'}})
				.then(function(folder) {
					expect(folder.hierarchyLevel).to.equal(1);
				});
			});
			
			it('should create hierarchy table records', function() {
				return this.foldersAncestor.findAll({where: {folderId: this.folders.a.id}}).bind(this)
				.then(function(ancestors) {
					expect(ancestors.length).to.equal(0);
				});
			});
		});
		
		describe('for 2nd level', function() {		
			it('should set hierarchyLevel', function() {
				return this.folder.find({where: {name: 'ab'}})
				.then(function(folder) {
					expect(folder.hierarchyLevel).to.equal(2);
				});
			});
			
			it('should create hierarchy table records', function() {
				return this.foldersAncestor.findAll({where: {folderId: this.folders.ab.id}}).bind(this)
				.then(function(ancestors) {
					expect(ancestors.length).to.equal(1);
					expect(ancestors[0].ancestorId).to.equal(this.folders.a.id);
				});
			});
		});
		
		describe('for 3rd level', function() {		
			it('should set hierarchyLevel', function() {
				return this.folder.find({where: {name: 'abd'}})
				.then(function(folder) {
					expect(folder.hierarchyLevel).to.equal(3);
				});
			});
			
			it('should create hierarchy table records', function() {
				return this.foldersAncestor.findAll({where: {folderId: this.folders.abd.id}, order: [['ancestorId', 'ASC']]}).bind(this)
				.then(function(ancestors) {
					expect(ancestors.length).to.equal(2);
					expect(ancestors[0].ancestorId).to.equal(this.folders.a.id);
					expect(ancestors[1].ancestorId).to.equal(this.folders.ab.id);
				});
			});
		});
	});
	
	describe('#update', function() {
		describe('for root level', function() {
			beforeEach(function() {
				return this.folders.abdf.updateAttributes({parentId: null});
			});
			
			it('should set hierarchyLevel', function() {
				return this.folder.find({where: {name: 'abdf'}})
				.then(function(folder) {
					expect(folder.hierarchyLevel).to.equal(1);
				});
			});
			
			it('should update hierarchy table records', function() {
				return this.foldersAncestor.findAll({where: {folderId: this.folders.abdf.id}}).bind(this)
				.then(function(ancestors) {
					expect(ancestors.length).to.equal(0);
				});
			});
		});
		
		describe('for 2nd level', function() {
			beforeEach(function() {
				return this.folders.abdf.updateAttributes({parentId: this.folders.a.id});
			});
			
			it('should set hierarchyLevel', function() {
				return this.folder.find({where: {name: 'abdf'}})
				.then(function(folder) {
					expect(folder.hierarchyLevel).to.equal(2);
				});
			});
			
			it('should update hierarchy table records', function() {
				return this.foldersAncestor.findAll({where: {folderId: this.folders.abdf.id}}).bind(this)
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
			
			it('should set hierarchyLevel', function() {
				return this.folder.find({where: {name: 'abdf'}})
				.then(function(folder) {
					expect(folder.hierarchyLevel).to.equal(3);
				});
			});
			
			it('should update hierarchy table records', function() {
				return this.foldersAncestor.findAll({where: {folderId: this.folders.abdf.id}, order: [['ancestorId', 'ASC']]}).bind(this)
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
			
			it('should set hierarchyLevel for descendents', function() {
				return this.folder.find({where: {name: 'abdf'}})
				.then(function(folder) {
					expect(folder.hierarchyLevel).to.equal(5);
				});
			});
			
			it('should update hierarchy table records for descendents', function() {
				return this.folder.find({
					where: {id: this.folders.abdf.id},
					include: [{model: this.folder, as: 'ancestors'}],
					order: [[{model: this.folder, as: 'ancestors'}, 'hierarchyLevel', 'ASC']]
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
			it('should throw error if trying to make parent one of descendents', function() {
				var promise = this.folders.a.updateAttributes({parentId: this.folders.ab.id});
				return expect(promise).to.be.rejected;
			});
		});
	});
	
	describe('#destroy', function() {
		it('should remove hierarchy table records', function() {
			return this.folders.abdf.destroy().bind(this)
			.then(function() {
				return this.foldersAncestor.findAll({where: {folderId: this.folders.abdf.id}}).bind(this)
				.then(function(ancestors) {
					expect(ancestors.length).to.equal(0);
				});
			});
		});
		
		it('should throw error if try to destroy a record which has children', function() {
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
		
		it('should set hierarchyLevel for all rows', function() {
			return this.folder.find({where: {name: 'abeh'}}).bind(this)
			.then(function(folder) {
				expect(folder.hierarchyLevel).to.equal(4);
				
				return this.folder.find({where: {name: 'abi'}});
			})
			.then(function(folder) {
				expect(folder.hierarchyLevel).to.equal(3);
			});
		});
		
		it('should create hierarchy table records for all rows', function() {
			return this.folder.find({
				where: {name: 'abeh'},
				include: [{model: this.folder, as: 'ancestors'}],
				order: [[{model: this.folder, as: 'ancestors'}, 'hierarchyLevel', 'ASC']]
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
					order: [[{model: this.folder, as: 'ancestors'}, 'hierarchyLevel', 'ASC']]
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
		
		it('should set hierarchyLevel for all rows', function() {
			return Promise.each(['abdf', 'abdg'], function(name) {
				return this.folder.find({where: {name: name}}).bind(this)
				.then(function(folder) {
					expect(folder.hierarchyLevel).to.equal(3);
				});
			}.bind(this));
		});
		
		it('should create hierarchy table records for all rows', function() {
			return Promise.each(['abdf', 'abdg'], function(name) {
				return this.folder.find({
					where: {name: name},
					include: [{model: this.folder, as: 'ancestors'}],
					order: [[{model: this.folder, as: 'ancestors'}, 'hierarchyLevel', 'ASC']]
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
		it('should remove hierarchy table records for all rows', function() {
			return this.folder.destroy({where: {parentId: this.folders.abd.id}}).bind(this)
			.then(function() {
				return Promise.each(['abdf', 'abdg'], function(name) {
					return this.foldersAncestor.findAll({where: {folderId: this.folders[name].id}}).bind(this)
					.then(function(ancestors) {
						expect(ancestors.length).to.equal(0);
					});
				}.bind(this));
			});
		});
		
		it('should throw error if try to destroy a record which has children', function() {
			var promise = this.folder.destroy({where: {parentId: this.folders.ab.id}}).bind(this)
			return expect(promise).to.be.rejected;
		});
	});
});
