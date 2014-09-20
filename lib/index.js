// --------------------
// Sequelize hierarchy
// --------------------

// imports
var modelExtends = require('./modelExtends');

// exports
exports = module.exports = function(Sequelize) {
	// extend Model
	Sequelize.Utils._.extend(Sequelize.Model.prototype, modelExtends(Sequelize));
	
	return Sequelize;
};
