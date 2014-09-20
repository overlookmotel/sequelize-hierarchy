// --------------------
// Sequelize hierarchy
// Shims to model instance methods
// --------------------

// exports

module.exports = function(Sequelize) {
	var Promise = Sequelize.Promise;
	var Utils = Sequelize.Utils;
	var _ = Utils._;
	
	// return hooks
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
			var queryOptions = {where: {}, attributes: [levelFieldName]};
			queryOptions.where[model.primaryKeyAttribute] = parentId;

			return model.find(queryOptions, {raw: true, transaction: options.transaction})
			.then(function(parent) {
				// set hierarchy level
				values[levelFieldName] = parent[levelFieldName] + 1;
			});
		},
		afterCreate: function(item, options) {
			var model = item.Model,
				hierarchy = model.hierarchy,
				values = item.dataValues,
				parentId = values[hierarchy.foreignKey];
			
			// if no parent, exit - no hierarchy to create
			if (!parentId) return;
			
			// create row in hierarchy table for parent
			var itemId = item[model.primaryKeyAttribute];
			var through = hierarchy.through;
			
			return Promise.try(function() {
				// get ancestors
				
				// if parent is at top level, has no ancestors
				if (values[hierarchy.levelFieldName] == 2) return [];
				
				// get parent's ancestors
				var queryOptions = {where: {}, attributes: [hierarchy.throughForeignKey]};
				queryOptions.where[hierarchy.throughKey] = parentId;

				return through.findAll(queryOptions, {raw: true, transaction: options.transaction});
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
				
				return through.bulkCreate(ancestors, {transaction: options.transaction});
			})
			.return();
		},
		
		beforeUpdate: function(item, options) {
			var model = item.Model,
				sequelize = model.sequelize,
				hierarchy = model.hierarchy;
			
			// NB this presumes item has not been updated since it was originally retrieved
			var parentId = item.dataValues[hierarchy.foreignKey];
			var oldParentId = item._previousDataValues[hierarchy.foreignKey];
			
			// if parent has not changed, exit - no change to make
			if (parentId === oldParentId) return;
			
			return Promise.try(function() {
				// check that not trying to make item a child of one of its own children
				if (parentId === null) return;
				
				var where = {};
				where[hierarchy.throughKey] = parentId;
				where[hierarchy.throughForeignKey] = item[model.primaryKeyAttribute];

				return hierarchy.through.find({where: where}, {transaction: options.transaction})
				.then(function(illegalItem) {
					if (illegalItem) throw new Error('Parent cannot be a child of itself');
				});
			})
			.then(function() {
				// get parent's level
				if (parentId === null) return 0;
				
				var where = {};
				where[model.primaryKeyAttribute] = parentId;

				return model.find({where: where, attributes: [hierarchy.levelFieldName]}, {raw: true, transaction: options.transaction})
				.then(function(parent) {
					if (!parent) throw new Error('Parent does not exist');

					return parent[hierarchy.levelFieldName];
				});
			})
			.then(function(parentLevel) {
				// set hierarchy level
				var newLevel = parentLevel + 1;
				var levelChange = newLevel - item._previousDataValues[hierarchy.levelFieldName];
				
				item.dataValues[hierarchy.levelFieldName] = newLevel;
				
				// update level and hierarchy table
				return Promise.try(function() {
					if (!levelChange) return;
					
					// update hierarchy level for all descendents
					var sql = replaceIdentifiers(
						'UPDATE *item '
						+ 'SET *level = *level + :levelChange '
						+ 'WHERE *id IN ('
						+ '		SELECT *itemId '
						+ '		FROM *through AS ancestors '
						+ '		WHERE ancestors.*ancestorId = :id'
						+ ')',
						{
							item: model.tableName,
							through: hierarchy.through.tableName,
							level: hierarchy.levelFieldName,
							id: model.primaryKeyAttribute,
							itemId: hierarchy.throughKey,
							ancestorId: hierarchy.throughForeignKey
						}
					);

					return sequelize.query(sql, null, {transaction: options.transaction}, {id: item.id, levelChange: levelChange});
				})
				.then(function() {
					// delete ancestors from hierarchy table for item and all descendents
					if (oldParentId === null) return;
					
					var throughTableName = escapeIdentifier(hierarchy.through.tableName);
					var throughKey = escapeIdentifier(hierarchy.throughKey);
					var throughForeignKey = escapeIdentifier(hierarchy.throughForeignKey);
					
					var sql = replaceIdentifiers(
						'DELETE deleters '
						+ 'FROM *through AS deleters '
						+ 'INNER JOIN *through AS descendents ON descendents.*itemId = deleters.*itemId '
						+ 'INNER JOIN *through AS ancestors ON ancestors.*ancestorId = deleters.*ancestorId '
						+ 'WHERE ancestors.*itemId = :id '
						+ '		AND ('
						+ '			descendents.*ancestorId = :id '
						+ '			OR descendents.*itemId = :id'
						+ '		)',
						{
							through: hierarchy.through.tableName,
							itemId: hierarchy.throughKey,
							ancestorId: hierarchy.throughForeignKey
						}
					);
					
					return sequelize.query(sql, null, {transaction: options.transaction}, {id: item.id});
				})
				.then(function() {
					// insert ancestors into hierarchy table for item and all descendents
					if (parentId === null) return;
					
					var sql = replaceIdentifiers(
						'INSERT INTO *through (*itemId, *ancestorId) '
						+ 'SELECT descendents.*itemId, ancestors.*ancestorId '
						+ 'FROM ( '
						+ '			SELECT *itemId '
						+ '			FROM *through '
						+ '			WHERE *ancestorId = :id '
						+ '			UNION '
						+ '			SELECT :id '
						+ '		) AS descendents '
						+ '		INNER JOIN ('
						+ '			SELECT *ancestorId '
						+ '			FROM *through '
						+ '			WHERE *itemId = :parentId '
						+ '			UNION '
						+ '			SELECT :parentId'
						+ '		) AS ancestors',
						{
							through: hierarchy.through.tableName,
							itemId: hierarchy.throughKey,
							ancestorId: hierarchy.throughForeignKey
						}
					);
					
					return sequelize.query(sql, null, {transaction: options.transaction}, {id: item.id, parentId: parentId});
				});
			})
			.return();
		},
		
		beforeFind: function(options) {
			// check options do not include illegal hierarchies
			if (options.hierarchy) throw new Error('You cannot get hierarchy of ' + this.name + ' - at top level with find()');
			checkHierarchy(options, this);
		},
		afterFind: function(result, options) {
			// convert hierarchies into trees
			convertHierarchies(result, options, this);
		},
		
		beforeFindAll: function(options) {
			// check options do not include illegal hierarchies
			if (options.hierarchy && !this.hierarchy) throw new Error('You cannot get hierarchy of ' + this.name + ' - it is not hierarchical');
			checkHierarchy(options, this);
		},
		afterFindAll: function(results, options) {
			// convert hierarchies into trees
			convertHierarchies(results, options, this);
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
	
	function checkHierarchy(options, model)
	{
		// check options do not include illegal hierarchies - throw error if so
		(function traverse(options, model) {
			if (options.include) {
				options.include.forEach(function(include) {
					var includeModel = include.model;
					
					// if hierarchy set, check is legal
					if (include.hierarchy) {
						if (!includeModel.hierarchy) throw new Error('You cannot get hierarchy of ' + includeModel.name + ' - it is not hierarchical');
						if (includeModel !== model) throw new Error('You cannot get a hierarchy of ' + includeModel.name + ' without including it from a parent');
						if (include.as !== model.hierarchy.descendentsAs) throw new Error('You cannot set hierarchy on ' + model.name + ' without using the ' + model.hierarchy.descendentsAs + ' accessor');
					}
					
					// check includes
					traverse(include, includeModel);
				});
			}
		})(options, model);
	}
	
	function convertHierarchies(results, options, model)
	{
		// convert hierarchies into trees
		(function traverse(results, options, model, parent) {
			if (options.include) {
				options.include.forEach(function(include) {
					var includeModel = include.model,
						accessor = include.as;
					
					if (Array.isArray(results)) {
						results.forEach(function(result) {
							traverse(result[accessor], include, includeModel, result);
						});
					} else {
						traverse(results[accessor], include, includeModel, results);
					}
				});
			}
			
			if (options.hierarchy) convertHierarchy(results, model, parent);
		})(results, options, model, null);
	}
	
	function convertHierarchy(results, model, parent)
	{
		var hierarchy = model.hierarchy,
			primaryKey = model.primaryKeyAttribute,
			foreignKey = hierarchy.foreignKey,
			childrenAccessor = hierarchy.childrenAs,
			descendentsAccessor = hierarchy.descendentsAs,
			throughAccessor = Utils.singularize(hierarchy.through.name);
		
		// get parent id and move results from parent.descendents to parent.children
		var parentId = null;
		if (parent) {
			parentId = parent[primaryKey];
			
			parent.dataValues[childrenAccessor] = parent[childrenAccessor] = results;
			delete parent[descendentsAccessor];
			delete parent.dataValues[descendentsAccessor];
		}
		
		// run through all results, turning into tree
		
		// find rows which are not top level and move into references
		var references = {};
		
		for (var i = 0; i < results.length; i++) {
			var item = results[i];
			
			// remove reference to through table
			delete item[throughAccessor];
			delete item.dataValues[throughAccessor];
			
			// add into references
			references[item[primaryKey]] = item;
			
			// if not a root-level item, remove from results
			if (item[foreignKey] !== parentId) {
				results.splice(i, 1);
				i--;
			}
		}
		
		// run through references, nesting within parents
		_.forIn(references, function(item) {
			// nest inside parent
			var thisParentId = item[foreignKey];
			if (thisParentId !== parentId) {
				var parent = references[thisParentId];
				if (!parent[childrenAccessor]) parent.dataValues[childrenAccessor] = parent[childrenAccessor] = [];
				parent[childrenAccessor].push(item);
			}
		});
	}
};
