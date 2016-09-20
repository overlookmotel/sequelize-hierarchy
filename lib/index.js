// --------------------
// Sequelize hierarchy
// --------------------

// modules
var _ = require('lodash');

// imports
var modelExtendsFn = require('./modelExtends'),
	hooksUniversalFn = require('./hooksUniversal'),
	errors = require('./errors');

// exports
module.exports = function(Sequelize) {
	if (!Sequelize) Sequelize = require('sequelize');

	var modelExtends = modelExtendsFn(Sequelize),
		hooksUniversal = hooksUniversalFn(Sequelize);

	// add custom errors to Sequelize
	errors.init(Sequelize);

	// extend Model
	_.extend(Sequelize.Model.prototype, modelExtends);

	// add hook on Sequelize() to create universal hooks
	Sequelize.addHook('afterInit', function(sequelize) {
		// apply hooks
		_.forIn(hooksUniversal, function(hookFn, hookName) {
			sequelize.addHook(hookName, hookFn);
		});
	});

	// return Sequelize
	return Sequelize;
};
