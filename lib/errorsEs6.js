/* --------------------
 * Sequelize hierarchy
 * Errors - ES6 version using subclassing for Sequelize v4
 * In separate file to avoid error when run on Node before v4
 * ------------------*/

'use strict';

// Exports
module.exports = function(Sequelize) {
	// Define errors
	class HierarchyError extends Sequelize.Error {
		constructor(message) {
			super(message);
			this.name = 'SequelizeHierarchyError';
		}
	}

	return {HierarchyError};
};
