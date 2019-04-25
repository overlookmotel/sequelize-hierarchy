/* --------------------
 * Sequelize hierarchy
 * Hooks on individual models
 * ------------------*/

'use strict';

// Imports
const {
	valueFilteredByFields, addOptions, addToFields, inFields,
	removeSpacing, replaceTableNames, replaceFieldNames
} = require('./utils');

// Exports

module.exports = (Sequelize, patches) => {
	const {Promise, HierarchyError} = Sequelize,
		{findOne, findAll, query} = patches;

	return {
		beforeCreate,
		afterCreate,
		beforeUpdate,
		beforeBulkCreate,
		beforeBulkUpdate
	};

	function beforeCreate(item, options) {
		const model = this, // eslint-disable-line no-invalid-this
			{primaryKey, foreignKey, levelFieldName} = model.hierarchy,
			values = item.dataValues,
			parentId = valueFilteredByFields(foreignKey, item, options);

		// If no parent, set level and exit - no ancestor records to create
		if (!parentId) {
			values[levelFieldName] = 1;
			return undefined;
		}

		// Check that not trying to make item a child of itself
		const itemId = valueFilteredByFields(primaryKey, item, options);
		if (parentId === itemId) {
			return Promise.reject(new HierarchyError('Parent cannot be a child of itself'));
		}

		// Set level based on parent
		return findOne(
			model,
			addOptions({where: {[primaryKey]: parentId}, attributes: [levelFieldName]}, options)
		).then((parent) => {
			if (!parent) throw new HierarchyError('Parent does not exist');

			// Set hierarchy level
			values[levelFieldName] = parent[levelFieldName] + 1;
			addToFields(levelFieldName, options);
		});
	}

	function afterCreate(item, options) {
		const model = this, // eslint-disable-line no-invalid-this
			{
				primaryKey, foreignKey, levelFieldName, through, throughKey, throughForeignKey
			} = model.hierarchy,
			values = item.dataValues,
			parentId = valueFilteredByFields(foreignKey, item, options);

		// If no parent, exit - no hierarchy to create
		if (!parentId) return undefined;

		// Create row in hierarchy table for parent
		const itemId = values[primaryKey];

		return Promise.try(() => {
			// Get ancestors
			// If parent is at top level, has no ancestors
			if (values[levelFieldName] === 2) return [];

			// Get parent's ancestors
			return findAll(
				through,
				addOptions({where: {[throughKey]: parentId}, attributes: [throughForeignKey]}, options)
			);
		}).then((ancestors) => {
			// Add parent as ancestor
			ancestors.push({[throughForeignKey]: parentId});

			// Save ancestors
			ancestors = ancestors.map(ancestor => ({
				[throughForeignKey]: ancestor[throughForeignKey],
				[throughKey]: itemId
			}));

			return through.bulkCreate(ancestors, addOptions({}, options));
		}).return();
	}

	function beforeUpdate(item, options) {
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
		) return undefined;

		return Promise.try(() => {
			// If either old parentId or old level not known, get from database
			if (oldParentId !== undefined && oldLevel !== undefined) return undefined;

			return findOne(model, addOptions({
				where: {[primaryKey]: itemId}
			}, options)).then((itemRecord) => {
				oldParentId = itemRecord[foreignKey];
				oldLevel = itemRecord[levelFieldName];
			});
		}).then(() => {
			// If parent not changing, exit - no change to make
			if (parentId === oldParentId) return undefined;

			return Promise.try(() => {
				if (parentId === null) return 1;

				// Check that not trying to make item a child of itself
				if (parentId === itemId) throw new HierarchyError('Parent cannot be a child of itself');

				// Check that not trying to make item a child of one of its own descendents
				return findOne(
					through,
					addOptions({where: {[throughKey]: parentId, [throughForeignKey]: itemId}}, options)
				).then((illegalItem) => {
					if (illegalItem) throw new HierarchyError('Parent cannot be a child of itself');

					// Get level (1 more than parent)
					return findOne(
						model,
						addOptions({
							where: {[primaryKey]: parentId}, attributes: [levelFieldName]
						}, options)
					).then((parent) => {
						if (!parent) throw new HierarchyError('Parent does not exist');
						return parent[levelFieldName] + 1;
					});
				});
			}).then((level) => {
				// Set hierarchy level
				if (level === oldLevel) return undefined;

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
				sql = replaceFieldNames(sql, {
					itemId: throughKey, ancestorId: throughForeignKey
				}, through);

				return query(
					sequelize,
					sql,
					addOptions({replacements: {id: itemId, levelChange: level - oldLevel}}, options)
				);
			}).then(() => {
				// Delete ancestors from hierarchy table for item and all descendents
				if (oldParentId === null) return undefined;

				const {dialect} = sequelize.options;
				let sql;
				if (dialect === 'postgres') {
					sql = removeSpacing(`
						DELETE FROM *through
						USING *through AS descendents, *through AS ancestors
						WHERE descendents.*itemId = *through.*itemId
							AND ancestors.*ancestorId = *through.*ancestorId
							AND ancestors.*itemId = :id
							AND (
								descendents.*ancestorId = :id
								OR descendents.*itemId = :id
							)
					`);
				} else if (dialect === 'sqlite') {
					sql = removeSpacing(`
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
						)
					`);
				} else {
					// mySQL
					sql = removeSpacing(`
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
					`);
				}

				sql = replaceTableNames(sql, {through}, sequelize);
				sql = replaceFieldNames(sql, {
					itemId: throughKey, ancestorId: throughForeignKey
				}, through);

				return query(
					sequelize,
					sql,
					addOptions({replacements: {id: itemId}}, options)
				);
			}).then(() => {
				// Insert ancestors into hierarchy table for item and all descendents
				if (parentId === null) return undefined;

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
				sql = replaceFieldNames(sql, {
					itemId: throughKey, ancestorId: throughForeignKey
				}, through);

				return query(
					sequelize,
					sql,
					addOptions({replacements: {id: itemId, parentId}}, options)
				);
			});
		}).return();
	}

	function beforeBulkCreate(daos, options) {
		// Set individualHooks = true so that beforeCreate and afterCreate hooks run
		options.individualHooks = true;
	}

	function beforeBulkUpdate(options) {
		// Set individualHooks = true so that beforeUpdate and afterUpdate hooks run
		options.individualHooks = true;
	}
};
