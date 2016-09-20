// --------------------
// Sequelize hierarchy
// --------------------

// modules
var _ = require('lodash');

// imports
var patchesFn = require('./patches'),
	modelExtendsFn = require('./modelExtends'),
	hooksUniversalFn = require('./hooksUniversal'),
	errors = require('./errors');

// exports
module.exports = function(Sequelize) {
	if (!Sequelize) Sequelize = require('sequelize');

	var patches = patchesFn(Sequelize),
		modelExtends = modelExtendsFn(Sequelize),
		hooksUniversal = hooksUniversalFn(Sequelize);

	// add custom errors to Sequelize
	errors(Sequelize);

	// extend Model
	_.extend(patches.modelConstructor, modelExtends);

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
