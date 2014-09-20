// --------------------
// Sequelize hierarchy
// Shims to model instance methods
// --------------------

// imports
var utils = require('./utils');

// exports

module.exports = function(Sequelize) {
	var Promise = Sequelize.Promise;
	var Utils = utils(Sequelize);
	var _ = Utils._;
	
	// return hooks
	return {
		beforeCreate: function(item, options) {
			var model = item.Model;
			var hierarchy = model.hierarchy;
			var values = item.dataValues;
			var parentId = values[hierarchy.foreignKey];
			var levelFieldName = hierarchy.levelFieldName;
			
			// if no parent, set level and exit - no ancestor records to create
			if (!parentId) {
				values[levelFieldName] = 1;
				return Promise.resolve(); //xxx this line should not be neccesary but sequelize wants a promise returned
			}
			
			// set level based on parent
			var queryOptions = {where: {}, attributes: [levelFieldName]};
			queryOptions.where[model.primaryKeyAttribute] = parentId;

			return model.find(queryOptions, {raw: true, transaction: options.transaction}).then(function(parent) {
				// set hierarchy level
				values[levelFieldName] = parent[levelFieldName] + 1;
			});
		},
		afterCreate: function(item, options) {
			var model = item.Model;
			var hierarchy = model.hierarchy;
			var values = item.dataValues;
			var parentId = values[hierarchy.foreignKey];
			
			// if no parent, exit - no hierarchy to create
			if (!parentId) return Promise.resolve(); //xxx this line should not be neccesary but sequelize wants a promise returned
			
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
			var model = item.Model;
			var sequelize = model.sequelize;
			var hierarchy = model.hierarchy;
			
			// NB this presumes item has not been updated since it was originally retrieved
			var parentId = item.dataValues[hierarchy.foreignKey];
			var oldParentId = item._previousDataValues[hierarchy.foreignKey];
			
			// if parent has not changed, exit - no change to make
			if (parentId === oldParentId) return Promise.resolve(); //xxx this line should not be neccesary but sequelize wants a promise returned
			
			return Promise.try(function() {
				// check that not trying to make item a child of one of its own children
				if (parentId === null) return;
				
				var where = {};
				where[hierarchy.throughKey] = parentId;
				where[hierarchy.throughForeignKey] = item[model.primaryKeyAttribute];

				return hierarchy.through.find({where: where}, {transaction: options.transaction}).then(function(illegalItem) {
					if (illegalItem) throw new Error('Parent cannot be a child of itself');
				})
			})
			.then(function() {
				// get parent's level
				if (parentId === null) return 0;
				
				var where = {};
				where[model.primaryKeyAttribute] = parentId;

				return model.find({where: where, attributes: [hierarchy.levelFieldName]}, {raw: true, transaction: options.transaction}).then(function(parent) {
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

					return sequelize.query(sql, null, {transaction: options.transaction}, {id: item.id, levelChange: levelChange});
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
					
					return sequelize.query(sql, null, {transaction: options.transaction}, {id: item.id});
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
					
					return sequelize.query(sql, null, {transaction: options.transaction}, {id: item.id, parentId: parentId});
				});
			})
			.return();
		},
		
		beforeFind: function(options) {
			// check options do not include illegal hierarchies
			if (options.hierarchy) throw new Error('You cannot get hierarchy of ' + this.name + ' - at top level with find()');
			checkHierarchy(options, this);
			
			return Promise.resolve(); //xxx this line should not be neccesary but sequelize wants a promise returned
		},
		afterFind: function(result, options) {
			// convert hierarchies into trees
			convertHierarchies(result, options, this);
			
			return Promise.resolve(); //xxx this line should not be neccesary but sequelize wants a promise returned
		},
		
		beforeFindAll: function(options) {
			// check options do not include illegal hierarchies
			if (options.hierarchy && !this.hierarchy) throw new Error('You cannot get hierarchy of ' + this.name + ' - it is not hierarchical');
			checkHierarchy(options, this);
			
			return Promise.resolve(); //xxx this line should not be neccesary but sequelize wants a promise returned
		},
		afterFindAll: function(results, options) {
			// convert hierarchies into trees
			convertHierarchies(results, options, this);
			
			return Promise.resolve(); //xxx this line should not be neccesary but sequelize wants a promise returned
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
					var includeModel = include.model;
					var accessor = include.as;
					
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
		var hierarchy = model.hierarchy;
		var primaryKey = model.primaryKeyAttribute;
		var foreignKey = hierarchy.foreignKey;
		var childrenAccessor = hierarchy.childrenAs;
		var descendentsAccessor = hierarchy.descendentsAs;
		var throughAccessor = Utils.singularize(hierarchy.through.name);
		
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
