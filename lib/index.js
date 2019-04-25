/* --------------------
 * Sequelize hierarchy
 * Entry point
 * ------------------*/

'use strict';

// Modules
const _ = require('lodash');

// Imports
const patchesFn = require('./patches'),
	modelExtendsFn = require('./modelExtends'),
	hooksUniversalFn = require('./hooksUniversal'),
	errors = require('./errors');

// Exports

module.exports = function(Sequelize) {
	// eslint-disable-next-line global-require, import/no-extraneous-dependencies
	if (!Sequelize) Sequelize = require('sequelize');

	const patches = patchesFn(Sequelize),
		modelExtends = modelExtendsFn(Sequelize),
		hooksUniversal = hooksUniversalFn(Sequelize);

	// Add custom errors to Sequelize
	errors(Sequelize);

	// Extend Model
	Object.assign(patches.modelConstructor, modelExtends);

	// Add hook on Sequelize() to create universal hooks
	Sequelize.addHook('afterInit', (sequelize) => {
		// Apply hooks
		_.forIn(hooksUniversal, (hookFn, hookName) => {
			sequelize.addHook(hookName, hookFn);
		});
	});

	// Return Sequelize
	return Sequelize;
};
