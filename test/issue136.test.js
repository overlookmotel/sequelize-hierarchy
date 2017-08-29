// --------------------
// Sequelize hierarchy
// Tests
// --------------------

// modules
var chai = require('chai'),
	expect = chai.expect,
	promised = require('chai-as-promised'),
	Support = require(__dirname + '/support'),
	Sequelize = Support.Sequelize;

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
			var User = this.User = this.sequelize.define('user', {
			    id: {
			    	type: Sequelize.INTEGER.UNSIGNED,
			    	primaryKey: true,
			    	autoIncrement: true
			    },
			    username: {
			    	type: Sequelize.STRING,
			    }
			});

			var Comment = this.Comment = this.sequelize.define('comment', {
			    id: {
			    	type: Sequelize.INTEGER.UNSIGNED,
			    	primaryKey: true,
			    	autoIncrement: true,
			    }
			});
			Comment.isHierarchy();

			Comment.belongsTo(User);
			User.hasMany(Comment, { as: 'comments' });

			return this.sequelize.sync({ force: true });
		});

		afterEach(function() {
			// set parentId of all folders to null
			// (to avoid foreign constraint error in SQLite when dropping table)
			//return this.Category.update({parent_id: null}, {where: {parent_id: {ne: null}}, hooks: false}); // jshint ignore:line
		});

		describe('#findAll', function() {
			describe('can retrieve', function() {
				it('descendents', function() {
					return this.Comment.findAll({
					    include:[{
					        model: this.User,
					    }, {
					        model: this.Comment,
					        as: 'descendents',
					        hierarchy: true,
					        include: [{
					            model: this.User
					        }]
					    }]
					}).then(function(comments) {
						comments = makePlain(comments);
						expect(comments).to.deep.equal([]);
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
