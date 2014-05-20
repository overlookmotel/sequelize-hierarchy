// --------------------
// Sequelize hierarchy
// --------------------

// modules
var sequelizeTransactionPromises = require('sequelize-transaction-promises');

// imports
var modelExtends = require('./modelExtends');

// exports
exports = module.exports = function(Sequelize) {
	// augment Sequelize
	sequelizeTransactionPromises(Sequelize);
	
	// extend model
	Sequelize.Utils._.extend(Sequelize.Model.prototype, modelExtends(Sequelize));
	
	return Sequelize;
};
