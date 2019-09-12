/* --------------------
 * Sequelize hierarchy
 * Errors
 * ------------------*/

'use strict';

// Exports
module.exports = function(Sequelize) {
	class HierarchyError extends Sequelize.Error {
		constructor(message) {
			super(message);
			this.name = 'SequelizeHierarchyError';
		}
	}

	const errors = {
		HierarchyError,
		// Alias for backward-compatibility
		SequelizeHierarchyError: HierarchyError
	};

	// Add errors to Sequelize and sequelize
	Object.assign(Sequelize, errors);
	Object.assign(Sequelize.prototype, errors);
};
