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

		errors.SequelizeHierarchyError = function(message) {
			Sequelize.Error.call(this, message);
			this.name = 'SequelizeHierarchyError';
		};
		util.inherits(errors.SequelizeHierarchyError, Sequelize.Error);

		_.extend(Sequelize, errors);
		_.extend(Sequelize.prototype, errors);
	}
};
