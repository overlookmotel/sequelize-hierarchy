// --------------------
// Sequelize hierarchy
// Hooks
// --------------------

// exports

module.exports = function(Sequelize) {
	var Promise = Sequelize.Promise,
		Utils = Sequelize.Utils,
		_ = Utils._;
	
	// return hooks
	return {
		afterDefine: function(model) {
			if (model.options.hierarchy) model.isHierarchy(model.options.hierarchy);
		},
		
		beforeFind: function(options) {
			// check options do not include illegal hierarchies
			if (options.hierarchy && !this.hierarchy) throw new Error('You cannot get hierarchy of ' + this.name + ' - it is not hierarchical');
			checkHierarchy(options, this);
		},
		afterFind: function(result, options) {
			var parent;
			
			// where called from getDescendents, find id of parent
			if (options.hierarchy && options.includeMap) {
				var include = options.includeMap[Utils.singularize(this.hierarchy.through.name)];
				
				if (include && include._pseudo && include.where && include.where[this.hierarchy.throughForeignKey]) {
					parent = {dataValues: {}};
					parent[this.primaryKeyAttribute] = include.where[this.hierarchy.throughForeignKey];
				}
			}
			
			// convert hierarchies into trees
			convertHierarchies(result, options, this, parent);
		}
	};
	
	function checkHierarchy(options, model)
	{
		// check options do not include illegal hierarchies - throw error if so
		if (!options.include) return;
		
		options.include.forEach(function(include) {
			var includeModel = include.model;
			
			// if hierarchy set, check is legal
			if (include.hierarchy) {
				if (!includeModel.hierarchy) throw new Error('You cannot get hierarchy of ' + includeModel.name + ' - it is not hierarchical');
				if (includeModel !== model) throw new Error('You cannot get a hierarchy of ' + includeModel.name + ' without including it from a parent');
				if (include.as !== model.hierarchy.descendentsAs) throw new Error('You cannot set hierarchy on ' + model.name + ' without using the ' + model.hierarchy.descendentsAs + ' accessor');
			}
			
			// check includes
			checkHierarchy(include, includeModel);
		});
	}
	
	function convertHierarchies(results, options, model, parent)
	{
		// convert hierarchies into trees
		if (options.include) {
			options.include.forEach(function(include) {
				var includeModel = include.model,
					accessor = include.as;
				
				if (!Array.isArray(results)) results = [results];
				
				results.forEach(function(result) {
					convertHierarchies(result[accessor], include, includeModel, result);
				});
			});
		}
		
		if (options.hierarchy) convertHierarchy(results, model, parent);
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
