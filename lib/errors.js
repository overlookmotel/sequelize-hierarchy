// --------------------
// Sequelize hierarchy
// Errors
// --------------------

// modules
var _ = require('lodash'),
	util = require('util');

// exports
module.exports = {
	init: function(Sequelize) {
		var errors = {};

		// general error for all hierarchy errors
		errors.HierarchyError = function(message) {
			Sequelize.Error.call(this, message);
			this.name = 'SequelizeHierarchyError';
		};
		util.inherits(errors.HierarchyError, Sequelize.Error);

		// alias for error for backward-compatibility
		errors.SequelizeHierarchyError = errors.HierarchyError;

		_.extend(Sequelize, errors);
		_.extend(Sequelize.prototype, errors);
	}
};
