/* --------------------
 * Sequelize hierarchy
 * Patches to unify Sequlize versions 2.x.x, 3.x.x, 4.x.x and 5.x.x
 * ------------------*/

'use strict';

// Modules
const semverSelect = require('semver-select');

// eslint-disable-next-line import/no-extraneous-dependencies
const sequelizeVersionImported = require('sequelize/package.json').version;

// Import
const {addOptions} = require('./utils');

// Exports

// Function to define patches
module.exports = (Sequelize) => {
	// Get Sequelize version
	const sequelizeVersion = Sequelize.version || sequelizeVersionImported;

	// Define patches
	return semverSelect.object(sequelizeVersion, {
		/*
         * Patches underscoredIf location differing in v2
		 * NB Use of `... || {}` is to work around removal of `Sequelize.Utils._`
		 * in Sequelize v4.11.0.
         */
		underscoredIf: {
			'^2.0.0': (Sequelize.Utils._ || {}).underscoredIf,
			'>=3.0.0': Sequelize.Utils.underscoredIf
		},

		/*
		 * Patches `Utils.uppercaseFirst` removal in Sequelize v5
		 */
		uppercaseFirst: {
			'2.0.0 - 4.x.x': Sequelize.Utils.uppercaseFirst,
			'>=5.0.0': str => `${str[0].toUpperCase()}${str.slice(1)}`
		},

		/*
         * Patches to unify function signature changes between Sequelize v2 and v3
         */
		query: {
			'^2.0.0': (sequelize, sql, options) => sequelize.query(sql, null, options),
			'>=3.0.0': (sequelize, sql, options) => sequelize.query(sql, options)
		},

		findOne: {
			'^2.0.0': (model, options) => model.find(options, addOptions({}, options)),
			'^3.0.0': (model, options) => model.find(options),
			'>=4.0.0': (model, options) => model.findOne(options)
		},

		findAll: {
			'^2.0.0': (model, options) => model.findAll(options, addOptions({}, options)),
			'>=3.0.0': (model, options) => model.findAll(options)
		},

		truncate: {
			// Workaround for bug in sequelize v2 with `truncate` option on models with schemas
			'^2.0.0': (model, options) => {
				if (model.sequelize.options.dialect === 'postgres' && model.options.schema) {
					options.where = {};
				} else {
					options.truncate = true;
				}
				return model.destroy(options);
			},
			'>=3.0.0': (model, options) => {
				options.truncate = true;
				return model.destroy(options);
			}
		},

		/*
         * In Sequelize v2 + v3:
         *   - models are instanceof Sequelize.Model
         *   - model instances are instanceof model.Instance
         *   - model.Instance is subclass of Sequelize.Instance
         *   - models instances have a property `.Model` referring to the model they are one of
         *
         * In Sequelize v4:
         *   - models are subclasses of Sequelize.Model
         *   - model instances are instanceof their Model + therefore also instanceof Sequelize.Model
         *   - Sequelize.Instance does not exist
         *
         * The patches below account for these changes.
         */
		modelConstructor: {
			'2.0.0 - 3.x.x': Sequelize.Model.prototype,
			'>=4.0.0': Sequelize.Model
		},

		isModelInstance: {
			'2.0.0 - 3.x.x': item => item instanceof Sequelize.Instance,
			'>=4.0.0': item => item instanceof Sequelize.Model
		},

		instancePrototype: {
			'2.0.0 - 3.x.x': model => model.Instance.prototype,
			'>=4.0.0': model => model.prototype
		},

		modelInit: {
			'2.0.0 - 3.x.x': model => model.init(model.modelManager),
			'>=4.0.0': () => {}
		},

		/*
		 * Patch for `attributes` being replaced by `rawAttributes` in Sequelize v5
		 */
		attributes: {
			'2.0.0 - 4.x.x': model => model.attributes,
			'>=5.0.0': model => model.rawAttributes
		}
	});
};
