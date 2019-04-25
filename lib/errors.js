/* --------------------
 * Sequelize hierarchy
 * Errors
 * ------------------*/

'use strict';

// Modules
const _ = require('lodash'),
	util = require('util'),
	semverSelect = require('semver-select');

// Exports
module.exports = function(Sequelize) {
	/*
	 * For Sequelize v2 + v3, use `util.inherits` to subclass Error.
	 * For Sequelize v4, use ES6 class inheritance.
	 * ES6 class error is in separate file required at runtime, to avoid errors in Node before v4.
	 */
	const errors = semverSelect(Sequelize.version || '3.0.0', {
		'2.0.0 - 3.x.x': function() {
			// General error for all hierarchy errors
			function HierarchyError(message) {
				Sequelize.Error.call(this, message);
				this.name = 'SequelizeHierarchyError';
			}
			util.inherits(HierarchyError, Sequelize.Error);

			return {HierarchyError};
		},
		'>=4.0.0': function() {
			return require('./errorsEs6')(Sequelize); // eslint-disable-line global-require
		}
	})();

	// Alias for error for backward-compatibility
	errors.SequelizeHierarchyError = errors.HierarchyError;

	// Add errors to Sequelize and sequelize
	_.extend(Sequelize, errors);
	_.extend(Sequelize.prototype, errors);
};
