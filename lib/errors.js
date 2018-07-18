// --------------------
// Sequelize hierarchy
// Errors
// --------------------

// modules
var _ = require('lodash'),
	util = require('util'),
	semverSelect = require('semver-select');

// exports
module.exports = function(Sequelize) {
	/*
	 * For Sequelize v2 + v3, use `util.inherits` to subclass Error.
	 * For Sequelize v4, use ES6 class inheritance.
	 * ES6 class error is in separate file required at runtime, to avoid errors in Node before v4.
	 */
	console.log('BSLog: Sequelize.version = ' + Sequelize.version);
	var errors = semverSelect(Sequelize.version || '3.0.0', {
		'2.0.0 - 3.x.x': function() {
			console.log('BSLog: In 2.0.0 - 3.x.x catch');
			// general error for all hierarchy errors
			function HierarchyError(message) {
				Sequelize.Error.call(this, message);
				this.name = 'SequelizeHierarchyError';
			}
			util.inherits(HierarchyError, Sequelize.Error);

			return {HierarchyError: HierarchyError};
		},
		'>=4.0.0': function() {
			console.log('BSLog: In >=4.0.0 catch');
			return require('./errorsEs6')(Sequelize);
		},
		'>=5.x.x': function() {
			console.log('BSLog: In >=5.x.x catch');
			return require('./errorsEs6')(Sequelize);
		},
		'>=5.x.x-beta.x': function() {
			console.log('BSLog: In >=5.x.x-beta.x catch');
			return require('./errorsEs6')(Sequelize);
		}
	})();

	// alias for error for backward-compatibility
	errors.SequelizeHierarchyError = errors.HierarchyError;

	// add errors to Sequelize and sequelize
	_.extend(Sequelize, errors);
	_.extend(Sequelize.prototype, errors);
};
