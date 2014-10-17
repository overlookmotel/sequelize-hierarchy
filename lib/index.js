// --------------------
// Sequelize hierarchy
// --------------------

// imports
var modelExtends = require('./modelExtends'),
	hooksUniversal = require('./hooksUniversal'),
	errors = require('./errors'),
	utils = require('./utils');

// exports
module.exports = function(Sequelize) {
	if (!Sequelize) Sequelize = require('sequelize');
	
	var Utils = Sequelize.Utils,
		_ = Utils._;
	
	utils = utils(Sequelize);
	
	// add custom errors to Sequelize
	errors = errors(Sequelize);
	_.extend(Sequelize, errors);
	_.extend(Sequelize.prototype, errors);
	
	// extend Model
	_.extend(Sequelize.Model.prototype, modelExtends(Sequelize, utils));
	
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
