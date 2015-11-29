// --------------------
// Sequelize hierarchy
// Hooks on individual models
// --------------------

// imports
var utils = require('./utils'),
	patchesFn = require('./patches');

// exports

module.exports = function(Sequelize) {
	var patches = patchesFn(Sequelize);

	return {
		beforeCreate: function(item, options) {
			var model = item.Model,
				hierarchy = model.hierarchy,
				values = item.dataValues,
				parentId = values[hierarchy.foreignKey],
				levelFieldName = hierarchy.levelFieldName;

			// if no parent, set level and exit - no ancestor records to create
			if (!parentId) {
				values[levelFieldName] = 1;
				return;
			}

			// set level based on parent
			var queryOptions = utils.addOptions({where: {}, attributes: [levelFieldName]}, options);
			queryOptions.where[hierarchy.primaryKey] = parentId;

			return patches.find(model, queryOptions)
			.then(function(parent) {
				// set hierarchy level
				values[levelFieldName] = parent[levelFieldName] + 1;
			});
		},
		afterCreate: function(item, options) {
			var model = item.Model,
				Promise = model.sequelize.Sequelize.Promise,
				hierarchy = model.hierarchy,
				values = item.dataValues,
				parentId = values[hierarchy.foreignKey];

			// if no parent, exit - no hierarchy to create
			if (!parentId) return;

			// create row in hierarchy table for parent
			var itemId = item[hierarchy.primaryKey],
				through = hierarchy.through;

			return Promise.try(function() {
				// get ancestors

				// if parent is at top level, has no ancestors
				if (values[hierarchy.levelFieldName] == 2) return [];

				// get parent's ancestors
				var queryOptions = utils.addOptions({where: {}, attributes: [hierarchy.throughForeignKey]}, options);
				queryOptions.where[hierarchy.throughKey] = parentId;

				return patches.findAll(through, queryOptions);
			})
			.then(function(ancestors) {
				// add parent as ancestor
				var parentValues = {};
				parentValues[hierarchy.throughForeignKey] = parentId;
				ancestors.push(parentValues);
				return ancestors;
			})
			.then(function(ancestors) {
				// save ancestors
				ancestors = ancestors.map(function(_ancestor) {
					var ancestor = {};
					ancestor[hierarchy.throughForeignKey] = _ancestor[hierarchy.throughForeignKey];
					ancestor[hierarchy.throughKey] = itemId;
					return ancestor;
				});

				return through.bulkCreate(ancestors, utils.addOptions({}, options));
			})
			.return();
		},

		beforeUpdate: function(item, options) {
			var model = item.Model,
				sequelize = model.sequelize,
				Sequelize = sequelize.Sequelize,
				Promise = Sequelize.Promise,
				hierarchy = model.hierarchy;

			// NB this presumes item has not been updated since it was originally retrieved
			var parentId = item.dataValues[hierarchy.foreignKey],
				oldParentId = item._previousDataValues[hierarchy.foreignKey];

			// if parent has not changed, exit - no change to make
			if (parentId === oldParentId) return;

			return Promise.try(function() {
				// check that not trying to make item a child of one of its own children
				if (parentId === null) return;

				var where = {};
				where[hierarchy.throughKey] = parentId;
				where[hierarchy.throughForeignKey] = item[hierarchy.primaryKey];

				return patches.find(hierarchy.through, utils.addOptions({where: where}, options))
				.then(function(illegalItem) {
					if (illegalItem) throw new Sequelize.HierarchyError('Parent cannot be a child of itself');
				});
			})
			.then(function() {
				// get parent's level
				if (parentId === null) return 0;

				var where = {};
				where[hierarchy.primaryKey] = parentId;

				return patches.find(model, utils.addOptions({where: where, attributes: [hierarchy.levelFieldName]}, options))
				.then(function(parent) {
					if (!parent) throw new Sequelize.HierarchyError('Parent does not exist');

					return parent[hierarchy.levelFieldName];
				});
			})
			.then(function(parentLevel) {
				// set hierarchy level
				var newLevel = parentLevel + 1,
					levelChange = newLevel - item._previousDataValues[hierarchy.levelFieldName];

				item[hierarchy.levelFieldName] = newLevel;
				if (options.fields && options.fields.indexOf(hierarchy.levelFieldName) == -1) options.fields.push(hierarchy.levelFieldName);

				// update level and hierarchy table
				return Promise.try(function() {
					if (!levelChange) return;

					// update hierarchy level for all descendents
					var sql = 'UPDATE *item ' +
						'SET *level = *level + :levelChange ' +
						'WHERE *id IN (' +
						'	SELECT *itemId ' +
						'	FROM *through AS ancestors ' +
						'	WHERE ancestors.*ancestorId = :id' +
						')';

					sql = utils.replaceTableNames(sql, {through: hierarchy.through}, sequelize);
					sql = utils.replaceTableNames(sql, {item: model}, sequelize);
					sql = utils.replaceIdentifiers(sql, {
						level: hierarchy.levelFieldName,
						id: hierarchy.primaryKey,
						itemId: hierarchy.throughKey,
						ancestorId: hierarchy.throughForeignKey
					}, sequelize);

					return patches.query(sequelize, sql, utils.addOptions({replacements: {id: item.id, levelChange: levelChange}}, options));
				})
				.then(function() {
					// delete ancestors from hierarchy table for item and all descendents
					if (oldParentId === null) return;

					var sql;
					if (['postgres', 'postgres-native'].indexOf(sequelize.options.dialect) != -1) {
						sql = 'DELETE FROM *through ' +
							'USING *through AS descendents, *through AS ancestors ' +
							'WHERE descendents.*itemId = *through.*itemId ' +
							'	AND ancestors.*ancestorId = *through.*ancestorId ' +
							'	AND ancestors.*itemId = :id ' +
							'	AND (' +
							'		descendents.*ancestorId = :id ' +
							'		OR descendents.*itemId = :id' +
							'	)';
					} else if (sequelize.options.dialect == 'sqlite') {
						sql = 'DELETE FROM *through ' +
							'WHERE EXISTS (' +
							'	SELECT * ' +
							'	FROM *through AS deleters ' +
							'		INNER JOIN *through AS descendents ON descendents.*itemId = deleters.*itemId ' +
							'		INNER JOIN *through AS ancestors ON ancestors.*ancestorId = deleters.*ancestorId ' +
							'	WHERE deleters.*itemId = *through.*itemId ' +
							'		AND deleters.*ancestorId = *through.*ancestorId ' +
							'		AND ancestors.*ancestorId = *through.*ancestorId ' +
							'		AND ancestors.*itemId = :id ' +
							'		AND (' +
							'			descendents.*ancestorId = :id ' +
							'			OR descendents.*itemId = :id' +
							'		)' +
							')';
					} else {
						// mySQL
						sql = 'DELETE deleters ' +
							'FROM *through AS deleters ' +
							'	INNER JOIN *through AS descendents ON descendents.*itemId = deleters.*itemId ' +
							'	INNER JOIN *through AS ancestors ON ancestors.*ancestorId = deleters.*ancestorId ' +
							'WHERE ancestors.*itemId = :id ' +
							'	AND (' +
							'		descendents.*ancestorId = :id ' +
							'		OR descendents.*itemId = :id' +
							'	)';
					}

					sql = utils.replaceTableNames(sql, {through: hierarchy.through}, sequelize);

					sql = utils.replaceIdentifiers(sql, {
						itemId: hierarchy.throughKey,
						ancestorId: hierarchy.throughForeignKey
					}, sequelize);

					return patches.query(sequelize, sql, utils.addOptions({replacements: {id: item.id}}, options));
				})
				.then(function() {
					// insert ancestors into hierarchy table for item and all descendents
					if (parentId === null) return;

					var sql = 'INSERT INTO *through (*itemId, *ancestorId) ' +
						'SELECT descendents.*itemId, ancestors.*ancestorId ' +
						'FROM ( ' +
						'		SELECT *itemId ' +
						'		FROM *through ' +
						'		WHERE *ancestorId = :id ' +
						'		UNION ALL ' +
						'		SELECT :id ' +
						'	) AS descendents, ' +
						'	(' +
						'		SELECT *ancestorId ' +
						'		FROM *through ' +
						'		WHERE *itemId = :parentId ' +
						'		UNION ALL ' +
						'		SELECT :parentId' +
						'	) AS ancestors';

					sql = utils.replaceTableNames(sql, {through: hierarchy.through}, sequelize);

					sql = utils.replaceIdentifiers(sql, {
						itemId: hierarchy.throughKey,
						ancestorId: hierarchy.throughForeignKey
					}, sequelize);

					return patches.query(sequelize, sql, utils.addOptions({replacements: {id: item.id, parentId: parentId}}, options));
				});
			})
			.return();
		},

		beforeBulkCreate: function(daos, options) { // jshint ignore:line
			// set individualHooks = true so that beforeCreate and afterCreate hooks run
			options.individualHooks = true;
		},
		beforeBulkUpdate: function(options) {
			// set individualHooks = true so that beforeUpdate and afterUpdate hooks run
			options.individualHooks = true;
		}
	};
};
