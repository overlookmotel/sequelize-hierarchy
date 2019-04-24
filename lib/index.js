// --------------------
// Sequelize hierarchy
// --------------------

'use strict';

// modules
const _ = require('lodash');

// imports
const patchesFn = require('./patches'),
	modelExtendsFn = require('./modelExtends'),
	hooksUniversalFn = require('./hooksUniversal'),
	errors = require('./errors');

// exports
module.exports = function(Sequelize) {
	// eslint-disable-next-line global-require, import/no-extraneous-dependencies
	if (!Sequelize) Sequelize = require('sequelize');

	const patches = patchesFn(Sequelize),
		modelExtends = modelExtendsFn(Sequelize),
		hooksUniversal = hooksUniversalFn(Sequelize);

	// add custom errors to Sequelize
	errors(Sequelize);

	// extend Model
	_.extend(patches.modelConstructor, modelExtends);

	// add hook on Sequelize() to create universal hooks
	Sequelize.addHook('afterInit', (sequelize) => {
		// apply hooks
		_.forIn(hooksUniversal, (hookFn, hookName) => {
			sequelize.addHook(hookName, hookFn);
		});
	});

	// return Sequelize
	return Sequelize;
};
