/* --------------------
 * Sequelize hierarchy
 * Extended model methods
 * ------------------*/

'use strict';

// Modules
const _ = require('lodash');

// Imports
const {addOptions, humanize, makeCo} = require('./utils'),
	hooksModelFn = require('./hooksModel');

// Exports

module.exports = function(Sequelize, patches) {
	const {
			findAll, underscoredIf, uppercaseFirst, instancePrototype, truncate, attributes, modelInit
		} = patches,
		{co, coAll} = makeCo(Sequelize),
		hooksModel = hooksModelFn(Sequelize, patches),
		{singularize, pluralize} = Sequelize.Utils;

	return coAll({
		isHierarchy,
		rebuildHierarchy
	});

	function isHierarchy(options) {
		const model = this, // eslint-disable-line no-invalid-this
			modelName = model.name,
			{sequelize} = model;

		// Set up options
		if (!options || options === true) options = {};

		const modelOptions = model.options,
			globalOptions = sequelize.options.define || {};

		let {underscored} = modelOptions;
		if (underscored == null) underscored = globalOptions.underscored;
		const {underscoredAll} = globalOptions;

		options = Object.assign({
			as: 'parent',
			childrenAs: 'children',
			ancestorsAs: 'ancestors',
			descendentsAs: 'descendents',
			primaryKey: model.primaryKeyAttribute,
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
			throughKey: underscoredIf(`${modelName}${uppercaseFirst(primaryKey)}`, underscored),
			throughForeignKey: underscoredIf(
				`${singularize(ancestorsAs)}${uppercaseFirst(primaryKey)}`, underscored
			),
			through: `${modelName}${singularize(
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
					`${pluralize(modelName)}${ancestorsAsCamel}`, underscoredAll
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
		model.hierarchy = options;

		// Add level field to model
		const {levelFieldName} = options;
		attributes(model)[levelFieldName] = Object.assign(
			{type: options.levelFieldType},
			options.levelFieldAttributes
		);
		modelInit(model);

		// Create associations
		model.hasMany(model, {
			as: options.childrenAs,
			foreignKey,
			targetKey: primaryKey,
			onDelete
		});

		model.belongsTo(model, {
			as,
			foreignKey,
			targetKey: primaryKey
		});

		// NB Fetch attributes here rather than above when added level field
		// as `.attributes` object gets remade in `model.init()` in Sequelize v2 + v3
		const modelAttributes = attributes(model);

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
		const throughFields = {};
		for (const fieldName of [throughKey, throughForeignKey]) {
			const field = {type: primaryKeyType, allowNull: false, primaryKey: true};
			if (labels) field.label = humanize(fieldName);
			throughFields[fieldName] = field;
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
		model.belongsToMany(model, {
			as: descendentsAs,
			foreignKey: throughForeignKey,
			through
		});

		model.belongsToMany(model, {
			as: ancestorsAs,
			foreignKey: throughKey,
			through
		});

		// Remove ancestor and descendent setters
		const instanceProto = instancePrototype(model),
			{associations} = model,
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
			model.addHook(hookName, hookFn);
		});

		// Return model for chaining
		return model;
	}

	function* rebuildHierarchy(options) {
		if (!options) options = {};

		const model = this, // eslint-disable-line no-invalid-this
			{
				primaryKey, foreignKey, levelFieldName, throughKey, throughForeignKey, through
			} = model.hierarchy;

		const passedOptions = addOptions({}, options);

		// Truncate hierarchy through table
		yield truncate(through, passedOptions);

		// Go up tree level by level and set hierarchy level field
		// + create hierarchy through table records
		const processLevel = co(function*(level, parents) {
			// Find next level (i.e. children of last batch)
			const where = {[foreignKey]: parents ? parents.map(item => item.id) : null};

			let items = yield findAll(
				model,
				addOptions({where, attributes: [primaryKey, foreignKey]}, options)
			);

			if (!items.length) return;

			// Update hierarchy level
			yield model.update({[levelFieldName]: level}, addOptions({where}, options));

			// Add hierarchy path to items
			// + create array for inserting into through table
			const ancestors = [];

			items = items.map((item) => {
				const {[primaryKey]: itemId, [foreignKey]: parentId} = item;

				if (!parentId) return {id: itemId, path: [itemId]};

				const parentPath = parents.find(thisItem => thisItem.id === parentId).path;
				for (const ancestorId of parentPath) {
					ancestors.push({[throughKey]: itemId, [throughForeignKey]: ancestorId});
				}

				return {id: itemId, path: parentPath.concat([itemId])};
			});

			// Insert rows into hierarchy through table
			yield through.bulkCreate(ancestors, passedOptions);

			// Process next level of children
			yield processLevel(level + 1, items);
		});

		yield processLevel(1);

		// Return model for chaining
		return model;
	}
};
