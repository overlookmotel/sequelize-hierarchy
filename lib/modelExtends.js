/* --------------------
 * Sequelize hierarchy
 * Extended model methods
 * ------------------*/

'use strict';

// Modules
const _ = require('lodash');

// Imports
const utils = require('./utils'),
	patchesFn = require('./patches'),
	hooksModelFn = require('./hooksModel');

// Exports

module.exports = function(Sequelize) {
	const patches = patchesFn(Sequelize),
		hooksModel = hooksModelFn(Sequelize),
		{Utils} = Sequelize;

	return {
		isHierarchy(options) {
			const {sequelize} = this;

			// Set up options
			if (!options || options === true) options = {};

			const globalOptions = sequelize.options.define || {};

			const underscored = this.options.underscored != null
				? this.options.underscored
				: globalOptions.underscored;
			const {underscoredAll} = globalOptions;

			options = _.extend({
				as: 'parent',
				childrenAs: 'children',
				ancestorsAs: 'ancestors',
				descendentsAs: 'descendents',
				primaryKey: this.primaryKeyAttribute,
				levelFieldName: patches.underscoredIf('hierarchyLevel', underscored),
				// foreignKeyAttributes: undefined,
				// levelFieldAttributes: undefined,
				levelFieldType: _.includes(['postgres', 'mssql'], sequelize.options.dialect) ? Sequelize.INTEGER : Sequelize.INTEGER.UNSIGNED,
				freezeTableName: globalOptions.freezeTableName || false,
				throughSchema: this.options.schema,
				camelThrough: globalOptions.camelThrough || false,
				labels: globalOptions.labels || false
			}, sequelize.options.hierarchy || {}, options);

			const {singularize, uppercaseFirst} = Utils,
				{primaryKey, ancestorsAs} = options;
			_.defaults(options, {
				foreignKey: patches.underscoredIf(
					`${options.as}${uppercaseFirst(primaryKey)}`, underscored
				),
				throughKey: patches.underscoredIf(
					`${this.name}${uppercaseFirst(primaryKey)}`, underscored
				),
				throughForeignKey: patches.underscoredIf(
					`${singularize(ancestorsAs)}${uppercaseFirst(primaryKey)}`, underscored
				),
				through: `${this.name}${singularize(options.camelThrough ? uppercaseFirst(options.ancestorsAs) : options.ancestorsAs)}`
			});

			let throughTable;
			if (options.freezeTableName) {
				throughTable = options.through;
			} else {
				throughTable = patches.underscoredIf(
					Utils.pluralize(this.name)
					+ (
						options.camelThrough || underscoredAll
							? Utils.uppercaseFirst(options.ancestorsAs)
							: options.ancestorsAs
					), underscoredAll
				);
			}

			_.defaults(options, {throughTable});

			options.onDelete = (options.onDelete || 'RESTRICT').toUpperCase();
			if (!_.includes(['RESTRICT', 'CASCADE'], options.onDelete)) throw new Sequelize.HierarchyError("onDelete on hierarchies must be either 'RESTRICT' or 'CASCADE'");

			// Record hierarchy in model
			this.hierarchy = options;

			// Add level field to model
			const levelFieldDefinition = {type: options.levelFieldType};
			if (options.levelFieldAttributes) {
				_.extend(levelFieldDefinition, options.levelFieldAttributes);
			}

			this.attributes[options.levelFieldName] = levelFieldDefinition;
			patches.modelInit(this);

			// Create associations
			this.hasMany(this, {
				as: options.childrenAs,
				foreignKey: options.foreignKey,
				targetKey: options.primaryKey,
				onDelete: options.onDelete
			});
			this.belongsTo(this, {
				as: options.as,
				foreignKey: options.foreignKey,
				targetKey: options.primaryKey
			});

			// Add foreignKey attributes
			if (options.foreignKeyAttributes) {
				_.extend(this.attributes[options.foreignKey], options.foreignKeyAttributes);
			}

			// Create labels
			if (options.labels) {
				[options.levelFieldName, options.foreignKey].forEach((fieldName) => {
					const field = this.attributes[fieldName];
					if (field.label === undefined) field.label = utils.humanize(fieldName);
				});
			}

			// Create through table
			const throughFields = {};
			throughFields[options.throughKey] = {
				type: this.attributes[options.primaryKey].type,
				allowNull: false,
				primaryKey: true
			};
			throughFields[options.throughForeignKey] = {
				type: this.attributes[options.primaryKey].type,
				allowNull: false,
				primaryKey: true
			};

			if (options.labels) {
				_.forIn(throughFields, (field, fieldName) => {
					field.label = utils.humanize(fieldName);
				});
			}

			options.through = sequelize.define(options.through, throughFields, {
				timestamps: false,
				paranoid: false,
				tableName: options.throughTable,
				schema: options.throughSchema
			});

			// Create associations through join table
			this.belongsToMany(this, {
				as: options.descendentsAs,
				foreignKey: options.throughForeignKey,
				through: options.through
			});

			this.belongsToMany(this, {
				as: options.ancestorsAs,
				foreignKey: options.throughKey,
				through: options.through
			});

			// Remove ancestor and descendent setters
			const instancePrototype = patches.instancePrototype(this);
			for (const accessorType of [
				'set', 'add', 'addMultiple', 'create', 'remove', 'removeMultiple'
			]) {
				delete instancePrototype[this.associations[options.ancestorsAs].accessors[accessorType]];
				delete this.associations[options.ancestorsAs].accessors[accessorType];
				delete instancePrototype[
					this.associations[options.descendentsAs].accessors[accessorType]
				];
				delete this.associations[options.descendentsAs].accessors[accessorType];
			}

			// Apply hooks
			_.forIn(hooksModel, (hookFn, hookName) => {
				this.addHook(hookName, hookFn);
			});

			// Return this for chaining
			return this;
		},

		rebuildHierarchy(options) {
			if (!options) options = {};

			const model = this,
				{hierarchy} = this,
				{primaryKey} = hierarchy,
				{foreignKey} = hierarchy,
				{throughKey} = hierarchy,
				{throughForeignKey} = hierarchy,
				{levelFieldName} = hierarchy,
				{through} = hierarchy;

			// Truncate hierarchy through table
			return patches.truncate(through, utils.addOptions({}, options)).then(() => {
				// Go up tree level by level and set hierarchy level field
				// + create hierarchy through table records
				const updateAttr = {};
				updateAttr[levelFieldName] = 0;

				return (function processLevel(parents) {
					// Find next level (i.e. children of last batch)
					const where = {};
					where[foreignKey] = parents ? parents.map(item => item[primaryKey]) : null;

					return patches.findAll(
						model,
						utils.addOptions({
							where,
							attributes: [primaryKey, foreignKey]
						}, options)
					).then((items) => {
						if (!items.length) return undefined;

						// Update hierarchy level
						updateAttr[levelFieldName]++;

						return model.update(updateAttr, utils.addOptions({where}, options)).then(() => {
							// Add hierarchy path to newItems from items
							// + create array for inserting into through table
							const ancestors = [];

							items = items.map((item) => {
								const itemId = item[primaryKey];
								const parentId = item[foreignKey];
								const parent = parentId !== null
									? _.find(parents, {id: parentId})
									: {path: []};

								parent.path.forEach((ancestorId) => {
									const ancestor = {};
									ancestor[throughKey] = itemId;
									ancestor[throughForeignKey] = ancestorId;

									ancestors.push(ancestor);
								});

								const path = parent.path.slice();
								path.push(itemId);
								return {id: itemId, path};
							});

							// Insert rows into hierarchy through table
							return through.bulkCreate(
								ancestors,
								utils.addOptions({}, options)
							).then(() => processLevel(items));
						});
					});
				}());
			}).return(model); // Return model for chaining
		}
	};
};
