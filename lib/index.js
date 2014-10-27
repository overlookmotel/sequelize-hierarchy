// --------------------
// Sequelize hierarchy
// --------------------

// modules
var _ = require('lodash');

// imports
var modelExtends = require('./modelExtends'),
	hooksUniversal = require('./hooksUniversal'),
	errors = require('./errors'),
	utils = require('./utils');

// exports
module.exports = function(Sequelize) {
	if (!Sequelize) Sequelize = require('sequelize');
	
	utils = utils(Sequelize);
	
	// add custom errors to Sequelize
	errors.init(Sequelize);
	
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
