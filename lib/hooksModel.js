/* --------------------
 * Sequelize hierarchy
 * Hooks on individual models
 * ------------------*/

'use strict';

// Imports
const {
	valueFilteredByFields, addOptions, addToFields, inFields,
	removeSpacing, replaceTableNames, replaceFieldNames, makeCo
} = require('./utils');

// Constants
const PARENT = Symbol('PARENT');

// Exports

module.exports = (Sequelize, patches) => {
	const {HierarchyError} = Sequelize,
		{co, coAll} = makeCo(Sequelize),
		{findOne, findAll, query} = patches;

	const beforeUpdate = co(_beforeUpdate);
	return coAll({
		beforeCreate,
		afterCreate,
		beforeUpdate,
		beforeBulkCreate,
		beforeBulkUpdate
	});

	function* beforeCreate(item, options) {
		const model = this, // eslint-disable-line no-invalid-this
			{primaryKey, foreignKey, levelFieldName} = model.hierarchy,
			values = item.dataValues,
			parentId = valueFilteredByFields(foreignKey, item, options);

		// If no parent, set level and exit - no ancestor records to create
		if (!parentId) {
			values[levelFieldName] = 1;
			return;
		}

		// Check that not trying to make item a child of itself
		const itemId = valueFilteredByFields(primaryKey, item, options);
		if (parentId === itemId) throw new HierarchyError('Parent cannot be a child of itself');

		// Set level based on parent
		const parent = yield findOne(
			model,
			addOptions({where: {[primaryKey]: parentId}, attributes: [levelFieldName]}, options)
		);
		if (!parent) throw new HierarchyError('Parent does not exist');

		// Set hierarchy level
		values[levelFieldName] = parent[levelFieldName] + 1;
		addToFields(levelFieldName, options);
	}

	function* afterCreate(item, options) {
		const model = this, // eslint-disable-line no-invalid-this
			{
				primaryKey, foreignKey, levelFieldName, through, throughKey, throughForeignKey
			} = model.hierarchy,
			values = item.dataValues,
			parentId = valueFilteredByFields(foreignKey, item, options);

		// If no parent, exit - no hierarchy to create
		if (!parentId) return;

		// Create row in hierarchy table for parent
		const itemId = values[primaryKey];

		// Get ancestors
		let ancestors;
		if (values[levelFieldName] === 2) {
			// If parent is at top level - no ancestors
			ancestors = [];
		} else {
			// Get parent's ancestors
			ancestors = yield findAll(
				through,
				addOptions({where: {[throughKey]: parentId}, attributes: [throughForeignKey]}, options)
			);
		}

		// Add parent as ancestor
		ancestors.push({[throughForeignKey]: parentId});

		// Save ancestors
		ancestors = ancestors.map(ancestor => ({
			[throughForeignKey]: ancestor[throughForeignKey],
			[throughKey]: itemId
		}));

		yield through.bulkCreate(ancestors, addOptions({}, options));
	}

	function* _beforeUpdate(item, options) {
		const model = this, // eslint-disable-line no-invalid-this
			{sequelize} = model,
			{
				primaryKey, foreignKey, levelFieldName, through, throughKey, throughForeignKey
			} = model.hierarchy,
			values = item.dataValues;

		// NB This presumes item has not been updated since it was originally retrieved
		const itemId = values[primaryKey],
			parentId = values[foreignKey];
		let oldParentId = item._previousDataValues[foreignKey],
			oldLevel = item._previousDataValues[levelFieldName];

		// If parent not being updated, exit - no change to make
		if (
			(oldParentId !== undefined && parentId === oldParentId)
			|| !inFields(foreignKey, options)
		) return;

		if (oldParentId === undefined || oldLevel === undefined) {
			const itemRecord = yield findOne(model, addOptions({
				where: {[primaryKey]: itemId}
			}, options));
			oldParentId = itemRecord[foreignKey];
			oldLevel = itemRecord[levelFieldName];
		}

		// If parent not changing, exit - no change to make
		if (parentId === oldParentId) return;

		// Get level (1 more than parent)
		let level;
		if (parentId === null) {
			level = 1;
		} else {
			// Check that not trying to make item a child of itself
			if (parentId === itemId) throw new HierarchyError('Parent cannot be a child of itself');

			// Use parent already fetched by `beforeBulkUpdate` hook, if present
			let parent = options[PARENT];
			if (!parent) {
				parent = yield findOne(
					model,
					addOptions({
						where: {[primaryKey]: parentId}, attributes: [levelFieldName, foreignKey]
					}, options)
				);
				if (!parent) throw new HierarchyError('Parent does not exist');
			}

			level = parent[levelFieldName] + 1;

			// Check that not trying to make item a child of one of its own descendents
			let illegal;
			if (parent[foreignKey] === itemId) {
				illegal = true;
			} else if (level > oldLevel + 2) {
				illegal = yield findOne(
					through,
					addOptions({where: {[throughKey]: parentId, [throughForeignKey]: itemId}}, options)
				);
			}
			if (illegal) throw new HierarchyError('Parent cannot be a descendent of itself');
		}

		// Set hierarchy level
		if (level !== oldLevel) {
			values[levelFieldName] = level;
			addToFields(levelFieldName, options);

			// Update hierarchy level for all descendents
			let sql = removeSpacing(`
				UPDATE *item
				SET *level = *level + :levelChange
				WHERE *id IN (
					SELECT *itemId
					FROM *through AS ancestors
					WHERE ancestors.*ancestorId = :id
				)
			`);
			sql = replaceTableNames(sql, {item: model, through}, sequelize);
			sql = replaceFieldNames(sql, {level: levelFieldName, id: primaryKey}, model);
			sql = replaceFieldNames(sql, {itemId: throughKey, ancestorId: throughForeignKey}, through);

			yield query(
				sequelize,
				sql,
				addOptions({replacements: {id: itemId, levelChange: level - oldLevel}}, options)
			);
		}

		// Delete ancestors from hierarchy table for item and all descendents
		if (oldParentId !== null) {
			const {dialect} = sequelize.options;
			// eslint-disable-next-line no-nested-ternary
			let sql = dialect === 'postgres' ? `
					DELETE FROM *through
					USING *through AS descendents, *through AS ancestors
					WHERE descendents.*itemId = *through.*itemId
						AND ancestors.*ancestorId = *through.*ancestorId
						AND ancestors.*itemId = :id
						AND (
							descendents.*ancestorId = :id
							OR descendents.*itemId = :id
						)`
				: dialect === 'sqlite' ? `
					DELETE FROM *through
					WHERE EXISTS (
						SELECT *
						FROM *through AS deleters
							INNER JOIN *through AS descendents
								ON descendents.*itemId = deleters.*itemId
							INNER JOIN *through AS ancestors
								ON ancestors.*ancestorId = deleters.*ancestorId
						WHERE deleters.*itemId = *through.*itemId
							AND deleters.*ancestorId = *through.*ancestorId
							AND ancestors.*ancestorId = *through.*ancestorId
							AND ancestors.*itemId = :id
							AND (
								descendents.*ancestorId = :id
								OR descendents.*itemId = :id
							)
					)`
				// eslint-disable-next-line indent
				: /* MySQL */ `
					DELETE deleters
					FROM *through AS deleters
						INNER JOIN *through AS descendents ON descendents.*itemId = deleters.*itemId
						INNER JOIN *through AS ancestors
							ON ancestors.*ancestorId = deleters.*ancestorId
					WHERE ancestors.*itemId = :id
						AND (
							descendents.*ancestorId = :id
							OR descendents.*itemId = :id
						)
				`;

			sql = removeSpacing(sql);
			sql = replaceTableNames(sql, {through}, sequelize);
			sql = replaceFieldNames(sql, {itemId: throughKey, ancestorId: throughForeignKey}, through);

			yield query(
				sequelize,
				sql,
				addOptions({replacements: {id: itemId}}, options)
			);
		}

		// Insert ancestors into hierarchy table for item and all descendents
		if (parentId !== null) {
			let sql = removeSpacing(`
				INSERT INTO *through (*itemId, *ancestorId)
				SELECT descendents.*itemId, ancestors.*ancestorId
				FROM (
						SELECT *itemId
						FROM *through
						WHERE *ancestorId = :id
						UNION ALL
						SELECT :id
					) AS descendents,
					(
						SELECT *ancestorId
						FROM *through
						WHERE *itemId = :parentId
						UNION ALL
						SELECT :parentId
					) AS ancestors
			`);
			sql = replaceTableNames(sql, {through}, sequelize);
			sql = replaceFieldNames(sql, {itemId: throughKey, ancestorId: throughForeignKey}, through);

			yield query(
				sequelize,
				sql,
				addOptions({replacements: {id: itemId, parentId}}, options)
			);
		}
	}

	function beforeBulkCreate(daos, options) {
		// Set individualHooks = true so that beforeCreate and afterCreate hooks run
		options.individualHooks = true;
	}

	function* beforeBulkUpdate(options) {
		const model = this, // eslint-disable-line no-invalid-this
			{primaryKey, foreignKey, levelFieldName} = model.hierarchy;

		// If not updating `parentId`, exit
		if (!inFields(foreignKey, options)) return;

		// Fetch items to be updated
		const items = yield findAll(model, addOptions({
			where: options.where,
			attributes: [primaryKey, foreignKey, levelFieldName]
		}, options));

		// Get level
		const {attributes} = options,
			parentId = attributes[foreignKey];
		let level;
		if (parentId === null) {
			level = 1;
		} else {
			const parent = yield findOne(
				model,
				addOptions({
					// NB `foreignKey` is used in `beforeUpdate`
					where: {[primaryKey]: parentId}, attributes: [levelFieldName, foreignKey]
				}, options)
			);
			if (!parent) throw new HierarchyError('Parent does not exist');

			level = parent[levelFieldName] + 1;

			// Record parent on options to be used by `beforeUpdate`
			options[PARENT] = parent;
		}

		// Set level
		attributes[levelFieldName] = level;
		addToFields(levelFieldName, options);

		// Run `beforeUpdate` hook on each item in series
		options = Object.assign({}, options);
		delete options.where;
		delete options.attributes;

		for (const item of items) {
			Object.assign(item, attributes);
			yield beforeUpdate.call(model, item, options);
		}
	}
};
