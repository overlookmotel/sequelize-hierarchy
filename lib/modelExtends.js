/* --------------------
 * Sequelize hierarchy
 * Extended model methods
 * ------------------*/

'use strict';

// Modules
const _ = require('lodash');

// Imports
const {addOptions, humanize} = require('./utils'),
	hooksModelFn = require('./hooksModel');

// Exports

module.exports = function(Sequelize, patches) {
	const {
			findAll, underscoredIf, uppercaseFirst, instancePrototype, truncate, attributes, modelInit
		} = patches,
		hooksModel = hooksModelFn(Sequelize, patches),
		{singularize, pluralize} = Sequelize.Utils;

	return {
		isHierarchy(options) {
			const {sequelize} = this;

			// Set up options
			if (!options || options === true) options = {};

			const modelOptions = this.options,
				globalOptions = sequelize.options.define || {};

			let {underscored} = modelOptions;
			if (underscored == null) underscored = globalOptions.underscored;
			const {underscoredAll} = globalOptions;

			options = Object.assign({
				as: 'parent',
				childrenAs: 'children',
				ancestorsAs: 'ancestors',
				descendentsAs: 'descendents',
				primaryKey: this.primaryKeyAttribute,
				levelFieldName: underscoredIf('hierarchyLevel', underscored),
				// foreignKeyAttributes: undefined,
				// levelFieldAttributes: undefined,
				levelFieldType: ['postgres', 'mssql'].includes(sequelize.options.dialect)
					? Sequelize.INTEGER
					: Sequelize.INTEGER.UNSIGNED,
				freezeTableName: globalOptions.freezeTableName || false,
				throughSchema: modelOptions.schema,
				camelThrough: globalOptions.camelThrough || false,
				labels: globalOptions.labels || false
			}, sequelize.options.hierarchy || {}, options);

			const {primaryKey, as, ancestorsAs, camelThrough} = options;
			_.defaults(options, {
				foreignKey: underscoredIf(`${as}${uppercaseFirst(primaryKey)}`, underscored),
				throughKey: underscoredIf(`${this.name}${uppercaseFirst(primaryKey)}`, underscored),
				throughForeignKey: underscoredIf(
					`${singularize(ancestorsAs)}${uppercaseFirst(primaryKey)}`, underscored
				),
				through: `${this.name}${singularize(
					camelThrough ? uppercaseFirst(ancestorsAs) : ancestorsAs
				)}`
			});

			const {foreignKey} = options;
			let {through, throughTable} = options;
			if (throughTable === undefined) {
				if (options.freezeTableName) {
					throughTable = through;
				} else {
					const ancestorsAsCamel = (camelThrough || underscoredAll)
						? uppercaseFirst(ancestorsAs)
						: ancestorsAs;

					throughTable = underscoredIf(
						`${pluralize(this.name)}${ancestorsAsCamel}`,
						underscoredAll
					);
					options.throughTable = throughTable;
				}
			}

			let {onDelete} = options;
			if (onDelete == null) {
				onDelete = 'RESTRICT';
			} else {
				onDelete = onDelete.toUpperCase();
				if (!['RESTRICT', 'CASCADE'].includes(onDelete)) {
					throw new Sequelize.HierarchyError("onDelete on hierarchies must be either 'RESTRICT' or 'CASCADE'");
				}
			}
			options.onDelete = onDelete;

			// Record hierarchy in model
			this.hierarchy = options;

			// Add level field to model
			const levelFieldDefinition = Object.assign(
				{type: options.levelFieldType},
				options.levelFieldAttributes
			);

			const {levelFieldName} = options;
			attributes(this)[levelFieldName] = levelFieldDefinition;
			modelInit(this);

			// Create associations
			this.hasMany(this, {
				as: options.childrenAs,
				foreignKey,
				targetKey: primaryKey,
				onDelete
			});
			this.belongsTo(this, {
				as,
				foreignKey,
				targetKey: primaryKey
			});

			// NB Fetch attributes here rather than above when added level field
			// as `.attributes` object gets remade in `model.init()` in Sequelize v2 + v3
			const modelAttributes = attributes(this);

			// Add foreignKey attributes
			Object.assign(modelAttributes[foreignKey], options.foreignKeyAttributes);

			// Create labels
			const {labels} = options;
			if (labels) {
				for (const fieldName of [levelFieldName, foreignKey]) {
					const field = modelAttributes[fieldName];
					if (field.label === undefined) field.label = humanize(fieldName);
				}
			}

			// Create through table
			const primaryKeyType = modelAttributes[primaryKey].type,
				{throughKey, throughForeignKey} = options;
			const throughFields = {
				[throughKey]: {
					type: primaryKeyType,
					allowNull: false,
					primaryKey: true
				},
				[throughForeignKey]: {
					type: primaryKeyType,
					allowNull: false,
					primaryKey: true
				}
			};

			if (labels) {
				_.forIn(throughFields, (field, fieldName) => {
					field.label = humanize(fieldName);
				});
			}

			through = sequelize.define(through, throughFields, {
				timestamps: false,
				paranoid: false,
				tableName: throughTable,
				schema: options.throughSchema
			});
			options.through = through;

			// Create associations through join table
			const {descendentsAs} = options;
			this.belongsToMany(this, {
				as: descendentsAs,
				foreignKey: throughForeignKey,
				through
			});

			this.belongsToMany(this, {
				as: ancestorsAs,
				foreignKey: throughKey,
				through
			});

			// Remove ancestor and descendent setters
			const instanceProto = instancePrototype(this),
				{associations} = this,
				ancestorsAssociationAccessors = associations[ancestorsAs].accessors,
				descendentsAssociationAccessors = associations[descendentsAs].accessors;
			for (const accessorType of [
				'set', 'add', 'addMultiple', 'create', 'remove', 'removeMultiple'
			]) {
				delete instanceProto[ancestorsAssociationAccessors[accessorType]];
				delete ancestorsAssociationAccessors[accessorType];
				delete instanceProto[descendentsAssociationAccessors[accessorType]];
				delete descendentsAssociationAccessors[accessorType];
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
				{
					primaryKey, foreignKey, levelFieldName, throughKey, throughForeignKey, through
				} = this.hierarchy;

			const passedOptions = addOptions({}, options);

			// Truncate hierarchy through table
			return truncate(through, passedOptions).then(() => {
				// Go up tree level by level and set hierarchy level field
				// + create hierarchy through table records
				const updateAttr = {[levelFieldName]: 0};

				return (function processLevel(parents) {
					// Find next level (i.e. children of last batch)
					const where = {
						[foreignKey]: parents ? parents.map(item => item[primaryKey]) : null
					};

					return findAll(
						model,
						addOptions({where, attributes: [primaryKey, foreignKey]}, options)
					).then((items) => {
						if (!items.length) return undefined;

						// Update hierarchy level
						updateAttr[levelFieldName]++;

						return model.update(updateAttr, addOptions({where}, options)).then(() => {
							// Add hierarchy path to newItems from items
							// + create array for inserting into through table
							const ancestors = [];

							items = items.map((item) => {
								const itemId = item[primaryKey],
									parentId = item[foreignKey];

								if (!parentId) return {id: itemId, path: [itemId]};

								const parent = parents.find(thisItem => thisItem.id === parentId),
									parentPath = parent.path;

								for (const ancestorId of parentPath) {
									ancestors.push({
										[throughKey]: itemId,
										[throughForeignKey]: ancestorId
									});
								}

								const path = parentPath.slice();
								path.push(itemId);
								return {id: itemId, path};
							});

							// Insert rows into hierarchy through table
							// eslint-disable-next-line arrow-body-style
							return through.bulkCreate(ancestors, passedOptions).then(() => {
								// Iterate to next level of children
								return processLevel(items);
							});
						});
					});
				}());
			}).return(model); // Return model for chaining
		}
	};
};
