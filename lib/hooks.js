// --------------------
// Sequelize hierarchy
// Shims to model instance methods
// --------------------

// exports

module.exports = function(Sequelize) {
	var Promise = Sequelize.Promise;
	var _ = Sequelize.Utils._;
	
	// return shim methods
	return {
		beforeCreate: function(item) {
			var model = item.Model;
			var hierarchy = model.hierarchy;
			var values = item.dataValues;
			var parentId = values[hierarchy.foreignKey];
			var levelFieldName = hierarchy.levelFieldName;
			
			// if no parent, set level and exit - no ancestor records to create
			if (!parentId) {
				values[levelFieldName] = 1;
				return Promise.resolve(item);
			}
			
			// set level based on parent
			var queryOptions = {where: {}, attributes: [levelFieldName]};
			queryOptions.where[model.primaryKeyAttribute] = parentId;

			return model.find(queryOptions, {raw: true}).then(function(parent) {
				// set hierarchy level
				values[levelFieldName] = parent[levelFieldName] + 1;
				
				// return item
				return item;
			});
		},
		afterCreate: function(item) {
			var model = item.Model;
			var hierarchy = model.hierarchy;
			var values = item.dataValues;
			var parentId = values[hierarchy.foreignKey];
			
			// if no parent, exit - no hierarchy to create
			if (!parentId) return Promise.resolve(item);
			
			// create row in hierarchy table for parent
			var itemId = item[model.primaryKeyAttribute];
			var through = hierarchy.through;
			
			return Promise.resolve().then(function() {
				// get ancestors
				
				// if parent is at top level, has no ancestors
				if (values[hierarchy.levelFieldName] == 2) return [];
				
				// get parent's ancestors
				var queryOptions = {where: {}, attributes: [hierarchy.throughForeignKey]};
				queryOptions.where[hierarchy.throughKey] = parentId;

				return through.findAll(queryOptions, {raw: true});
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
				ancestors = ancestors.map(function(ancestor) {
					ancestor[hierarchy.throughKey] = itemId;
					return ancestor;
				});
				
				return through.bulkCreate(ancestors);
			})
			.return(item);
		},
		
		beforeUpdate: function(item) {
			var model = item.Model;
			var sequelize = model.sequelize;
			var hierarchy = model.hierarchy;
			
			// NB this presumes item has not been updated since it was originally retrieved
			var parentId = item.dataValues[hierarchy.foreignKey];
			var oldParentId = item._previousDataValues[hierarchy.foreignKey];
			
			// if parent has not changed, exit - no change to make
			if (parentId === oldParentId) return Promise.resolve(item);
			
			// set level based on parent
			var queryOptions = {where: {}, attributes: [hierarchy.levelFieldName]};
			queryOptions.where[model.primaryKeyAttribute] = parentId;
			
			return model.find(queryOptions, {raw: true}).then(function(parent) {
				// set hierarchy level
				var newLevel = parent[hierarchy.levelFieldName] + 1;
				var levelChange = newLevel - item._previousDataValues[hierarchy.levelFieldName];
				
				item.dataValues[hierarchy.levelFieldName] = newLevel;
				
				// update level and hierarchy table
				return Promise.resolve().then(function() {
					if (!levelChange) return;
					
					// update hierarchy level for all descendents
					var sql = replaceIdentifiers(
						'UPDATE *Item '
						+ 'SET *level = *level + :levelChange '
						+ 'WHERE *id IN ('
						+ '		SELECT *itemId '
						+ '		FROM *Through AS Ancestors '
						+ '		WHERE Ancestors.*ancestorId = :id'
						+ ')',
						{
							Item: model.tableName,
							Through: hierarchy.through.tableName,
							level: hierarchy.levelFieldName,
							id: model.primaryKeyAttribute,
							itemId: hierarchy.throughKey,
							ancestorId: hierarchy.throughForeignKey
						}
					);

					return sequelize.query(sql, null, null, {id: item.id, levelChange: levelChange});
				})
				.then(function() {
					// delete ancestors from hierarchy table for item and all descendents
					if (oldParentId === null) return;
					
					var throughTableName = escapeIdentifier(hierarchy.through.tableName);
					var throughKey = escapeIdentifier(hierarchy.throughKey);
					var throughForeignKey = escapeIdentifier(hierarchy.throughForeignKey);
					
					var sql = replaceIdentifiers(
						'DELETE Deleters '
						+ 'FROM *Through AS Deleters '
						+ 'INNER JOIN *Through AS Descendents ON Descendents.*itemId = Deleters.*itemId '
						+ 'INNER JOIN *Through AS Ancestors ON Ancestors.*ancestorId = Deleters.*ancestorId '
						+ 'WHERE Ancestors.*itemId = :id '
						+ '		AND ('
						+ '			Descendents.*ancestorId = :id '
						+ '			OR Descendents.*itemId = :id'
						+ '		)',
						{
							Through: hierarchy.through.tableName,
							itemId: hierarchy.throughKey,
							ancestorId: hierarchy.throughForeignKey
						}
					);
					
					return sequelize.query(sql, null, null, {id: item.id});
				})
				.then(function() {
					// insert ancestors into hierarchy table for item and all descendents
					if (parentId === null) return;
					
					var sql = replaceIdentifiers(
						'INSERT INTO *Through (*itemId, *ancestorId) '
						+ 'SELECT Descendents.*itemId, Ancestors.*ancestorId '
						+ 'FROM ( '
						+ '			SELECT *itemId '
						+ '			FROM *Through '
						+ '			WHERE *ancestorId = :id '
						+ '			UNION '
						+ '			SELECT :id '
						+ '		) AS Descendents '
						+ '		INNER JOIN ('
						+ '			SELECT *ancestorId '
						+ '			FROM *Through '
						+ '			WHERE *itemId = :parentId '
						+ '			UNION '
						+ '			SELECT :parentId'
						+ '		) AS Ancestors',
						{
							Through: hierarchy.through.tableName,
							itemId: hierarchy.throughKey,
							ancestorId: hierarchy.throughForeignKey
						}
					);
					
					return sequelize.query(sql, null, null, {id: item.id, parentId: parentId});
				});
			})
			.return(item);
		}
	};
	
	function replaceIdentifiers(sql, identifiers)
	{
		_.forIn(identifiers, function(replacement, identifier) {
			sql = sql.replace(new RegExp('\\*' + identifier, 'g'), escapeIdentifier(replacement));
		});
		return sql.replace(/[ \t\r\n]+/g, ' ');
	}
	
	function escapeIdentifier(identifier)
	{
		return '`' + identifier.replace(/`/g, '``') + '`';
	}
};
