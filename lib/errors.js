// --------------------
// errors
// --------------------

// modules
var util = require('util');

// exports
module.exports = function(Sequelize) {
	var errors = {};
	
	errors.SequelizeHierarchyError = function(message) {
		Sequelize.Error.call(this, message);
		this.name = 'SequelizeHierarchyError';
	};
	util.inherits(errors.SequelizeHierarchyError, Sequelize.Error);
	
	return errors;
};
