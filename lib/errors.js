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
	var errors = semverSelect(Sequelize.version || '3.0.0', {
		'2.0.0 - 3.x.x': function() {
			// general error for all hierarchy errors
			function HierarchyError(message) {
				Sequelize.Error.call(this, message);
				this.name = 'SequelizeHierarchyError';
			}
			util.inherits(HierarchyError, Sequelize.Error);

			return {HierarchyError: HierarchyError};
		},
		'>=4.0.0': function() {
			return require('./errorsEs6')(Sequelize);
		}
	})();

	// alias for error for backward-compatibility
	errors.SequelizeHierarchyError = errors.HierarchyError;

	// add errors to Sequelize and sequelize
	_.extend(Sequelize, errors);
	_.extend(Sequelize.prototype, errors);
};
