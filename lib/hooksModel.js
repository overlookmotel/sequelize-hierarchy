// --------------------
// Sequelize hierarchy
// Hooks on individual models
// --------------------

'use strict';

// imports
const utils = require('./utils'),
	patchesFn = require('./patches');

// exports

module.exports = function(Sequelize) {
	const patches = patchesFn(Sequelize),
		{Promise} = Sequelize;

	return {
		beforeCreate(item, options) {
			const {hierarchy} = this,
				values = item.dataValues,
				parentId = utils.valueFilteredByFields(hierarchy.foreignKey, item, options),
				{levelFieldName} = hierarchy;

			// if no parent, set level and exit - no ancestor records to create
			if (!parentId) {
				values[levelFieldName] = 1;
				return undefined;
			}

			// check that not trying to make item a child of itself
			const itemId = utils.valueFilteredByFields(hierarchy.primaryKey, item, options);
			if (parentId === itemId) return Promise.reject(new Sequelize.HierarchyError('Parent cannot be a child of itself'));

			// set level based on parent
			const queryOptions = utils.addOptions({where: {}, attributes: [levelFieldName]}, options);
			queryOptions.where[hierarchy.primaryKey] = parentId;

			return patches.find(this, queryOptions)
				.then((parent) => {
					if (!parent) throw new Sequelize.HierarchyError('Parent does not exist');

					// set hierarchy level
					values[levelFieldName] = parent[levelFieldName] + 1;
					utils.addToFields(levelFieldName, options);
				});
		},
		afterCreate(item, options) {
			const {hierarchy} = this,
				values = item.dataValues,
				parentId = utils.valueFilteredByFields(hierarchy.foreignKey, item, options);

			// if no parent, exit - no hierarchy to create
			if (!parentId) return undefined;

			// create row in hierarchy table for parent
			const itemId = values[hierarchy.primaryKey],
				{through} = hierarchy;

			return Promise.try(() => {
				// get ancestors

				// if parent is at top level, has no ancestors
				if (values[hierarchy.levelFieldName] === 2) return [];

				// get parent's ancestors
				const queryOptions = utils.addOptions({
					where: {},
					attributes: [hierarchy.throughForeignKey]
				}, options);
				queryOptions.where[hierarchy.throughKey] = parentId;

				return patches.findAll(through, queryOptions);
			})
				.then((ancestors) => {
				// add parent as ancestor
					const parentValues = {};
					parentValues[hierarchy.throughForeignKey] = parentId;
					ancestors.push(parentValues);
					return ancestors;
				})
				.then((ancestors) => {
				// save ancestors
					ancestors = ancestors.map((_ancestor) => {
						const ancestor = {};
						ancestor[hierarchy.throughForeignKey] = _ancestor[hierarchy.throughForeignKey];
						ancestor[hierarchy.throughKey] = itemId;
						return ancestor;
					});

					return through.bulkCreate(ancestors, utils.addOptions({}, options));
				})
				.return();
		},

		beforeUpdate(item, options) {
			const model = this,
				{sequelize} = model,
				{hierarchy} = model,
				values = item.dataValues;

			// NB this presumes item has not been updated since it was originally retrieved
			const itemId = values[hierarchy.primaryKey],
				parentId = values[hierarchy.foreignKey],
				oldParentId = item._previousDataValues[hierarchy.foreignKey];

			// if parent not changing, exit - no change to make
			if (
				parentId === oldParentId
				|| !utils.inFields(hierarchy.foreignKey, options)
			) return undefined;

			return Promise.try(() => {
				if (parentId === null) return undefined;

				// check that not trying to make item a child of itself
				if (parentId === itemId) {
					throw new Sequelize.HierarchyError('Parent cannot be a child of itself');
				}

				// check that not trying to make item a child of one of its own descendents
				const where = {};
				where[hierarchy.throughKey] = parentId;
				where[hierarchy.throughForeignKey] = itemId;

				return patches.find(hierarchy.through, utils.addOptions({where}, options))
					.then((illegalItem) => {
						if (illegalItem) throw new Sequelize.HierarchyError('Parent cannot be a child of itself');
					});
			})
				.then(() => {
				// get parent's level
					if (parentId === null) return 0;

					const where = {};
					where[hierarchy.primaryKey] = parentId;

					return patches.find(
						model,
						utils.addOptions({
							where,
							attributes: [hierarchy.levelFieldName]
						}, options)
					)
						.then((parent) => {
							if (!parent) throw new Sequelize.HierarchyError('Parent does not exist');

							return parent[hierarchy.levelFieldName];
						});
				})
				.then((parentLevel) => {
					// set hierarchy level
					const newLevel = parentLevel + 1,
						levelChange = newLevel - item._previousDataValues[hierarchy.levelFieldName];

					values[hierarchy.levelFieldName] = newLevel;
					utils.addToFields(hierarchy.levelFieldName, options);

					// update level and hierarchy table
					return Promise.try(() => {
						if (!levelChange) return undefined;

						// update hierarchy level for all descendents
						let sql = 'UPDATE *item '
							+ 'SET *level = *level + :levelChange '
							+ 'WHERE *id IN ('
							+ '  SELECT *itemId '
							+ '  FROM *through AS ancestors '
							+ '  WHERE ancestors.*ancestorId = :id'
							+ ')';

						sql = utils.replaceTableNames(sql, {
							item: model,
							through: hierarchy.through
						}, sequelize);

						sql = utils.replaceFieldNames(sql, {
							level: hierarchy.levelFieldName,
							id: hierarchy.primaryKey
						}, model);

						sql = utils.replaceFieldNames(sql, {
							itemId: hierarchy.throughKey,
							ancestorId: hierarchy.throughForeignKey
						}, hierarchy.through);

						return patches.query(
							sequelize,
							sql,
							utils.addOptions({replacements: {id: itemId, levelChange}}, options)
						);
					})
						.then(() => {
							// delete ancestors from hierarchy table for item and all descendents
							if (oldParentId === null) return undefined;

							let sql;
							if (sequelize.options.dialect === 'postgres') {
								sql = 'DELETE FROM *through '
									+ 'USING *through AS descendents, *through AS ancestors '
									+ 'WHERE descendents.*itemId = *through.*itemId '
									+ '  AND ancestors.*ancestorId = *through.*ancestorId '
									+ '  AND ancestors.*itemId = :id '
									+ '  AND ('
									+ '    descendents.*ancestorId = :id '
									+ '    OR descendents.*itemId = :id'
									+ '  )';
							} else if (sequelize.options.dialect === 'sqlite') {
								sql = 'DELETE FROM *through '
									+ 'WHERE EXISTS ('
									+ '  SELECT * '
									+ '  FROM *through AS deleters '
									+ '    INNER JOIN *through AS descendents ON descendents.*itemId = deleters.*itemId '
									+ '    INNER JOIN *through AS ancestors ON ancestors.*ancestorId = deleters.*ancestorId '
									+ '  WHERE deleters.*itemId = *through.*itemId '
									+ '    AND deleters.*ancestorId = *through.*ancestorId '
									+ '    AND ancestors.*ancestorId = *through.*ancestorId '
									+ '    AND ancestors.*itemId = :id '
									+ '    AND ('
									+ '      descendents.*ancestorId = :id '
									+ '      OR descendents.*itemId = :id'
									+ '    )'
									+ ')';
							} else {
								// mySQL
								sql = 'DELETE deleters '
									+ 'FROM *through AS deleters '
									+ '  INNER JOIN *through AS descendents ON descendents.*itemId = deleters.*itemId '
									+ '  INNER JOIN *through AS ancestors ON ancestors.*ancestorId = deleters.*ancestorId '
									+ 'WHERE ancestors.*itemId = :id '
									+ '  AND ('
									+ '    descendents.*ancestorId = :id '
									+ '    OR descendents.*itemId = :id'
									+ '  )';
							}

							sql = utils.replaceTableNames(sql, {through: hierarchy.through}, sequelize);

							sql = utils.replaceFieldNames(sql, {
								itemId: hierarchy.throughKey,
								ancestorId: hierarchy.throughForeignKey
							}, hierarchy.through);

							return patches.query(
								sequelize,
								sql,
								utils.addOptions({replacements: {id: itemId}}, options)
							);
						})
						.then(() => {
							// insert ancestors into hierarchy table for item and all descendents
							if (parentId === null) return undefined;

							let sql = 'INSERT INTO *through (*itemId, *ancestorId) '
								+ 'SELECT descendents.*itemId, ancestors.*ancestorId '
								+ 'FROM ( '
								+ '    SELECT *itemId '
								+ '    FROM *through '
								+ '    WHERE *ancestorId = :id '
								+ '    UNION ALL '
								+ '    SELECT :id '
								+ '  ) AS descendents, '
								+ '  ('
								+ '    SELECT *ancestorId '
								+ '    FROM *through '
								+ '    WHERE *itemId = :parentId '
								+ '    UNION ALL '
								+ '    SELECT :parentId'
								+ '  ) AS ancestors';

							sql = utils.replaceTableNames(sql, {through: hierarchy.through}, sequelize);

							sql = utils.replaceFieldNames(sql, {
								itemId: hierarchy.throughKey,
								ancestorId: hierarchy.throughForeignKey
							}, hierarchy.through);

							return patches.query(
								sequelize,
								sql,
								utils.addOptions({replacements: {id: itemId, parentId}}, options)
							);
						});
				})
				.return();
		},

		beforeBulkCreate(daos, options) {
			// set individualHooks = true so that beforeCreate and afterCreate hooks run
			options.individualHooks = true;
		},
		beforeBulkUpdate(options) {
			// set individualHooks = true so that beforeUpdate and afterUpdate hooks run
			options.individualHooks = true;
		}
	};
};
