// --------------------
// Sequelize hierarchy
// --------------------

// imports
var modelExtends = require('./modelExtends'),
	hooksUniversal = require('./hooksUniversal');

// exports
module.exports = function(Sequelize) {
	if (!Sequelize) Sequelize = require('sequelize');
	
	var Utils = Sequelize.Utils,
		_ = Utils._;
	
	// extend Model
	_.extend(Sequelize.Model.prototype, modelExtends(Sequelize));
	
	// add hook on Sequelize() to create universal hooks
	var hooks = hooksUniversal(Sequelize);
	
	Sequelize.addHook('afterInit', function(sequelize) {
		// apply hooks
		_.forIn(hooks, function(hookFn, hookName) {
			sequelize.addHook(hookName, hookFn);
		});
	});
	
	return Sequelize;
};
