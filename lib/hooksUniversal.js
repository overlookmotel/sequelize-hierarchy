// --------------------
// Sequelize hierarchy
// Hooks on all models
// --------------------

// modules
var _ = require('lodash');

// imports
var utils = require('./utils');

// exports

module.exports = {
	afterDefine: function(model) {
		var Sequelize = this.Sequelize,
			Utils = Sequelize.Utils;

		// get hierarchy option
		var hierarchy = model.options.hierarchy;

		// check for hierarchy set on a field
		_.forIn(model.attributes, function(field, fieldName) {
			if (!field.hierarchy) return;

			if (hierarchy) throw new Sequelize.SequelizeHierarchyError("You cannot define hierarchy on two attributes, or an attribute and the model options, in '" + model.name + "'");

			hierarchy = field.hierarchy;
			if (hierarchy === true) hierarchy = {};

			// deduce foreignKey and as for the hierarchy from field name
			hierarchy.foreignKey = fieldName;
			var primaryKey = model.primaryKeyAttribute;
			if (!hierarchy.as) {
				if (utils.endsWith(fieldName, Utils.uppercaseFirst(primaryKey))) {
					hierarchy.as = fieldName.slice(0, -primaryKey.length);
				} else if (utils.endsWith(fieldName, '_' + primaryKey)) {
					hierarchy.as = fieldName.slice(0, -primaryKey.length - 1);
				} else {
					hierarchy.as = fieldName;
				}
			}

			model.options.hierarchy = hierarchy;
			field.hierarchy = true;
		});

		// if hierarchy set, init hierarchy
		if (hierarchy) model.isHierarchy(hierarchy);
	},

	beforeFindAfterExpandIncludeAll: function(options) {
		var Sequelize = this.sequelize.Sequelize;

		// check options do not include illegal hierarchies
		var hierarchyExists = false;
		if (options.hierarchy) {
			if (!this.hierarchy) throw new Sequelize.SequelizeHierarchyError("You cannot get hierarchy of '" + this.name + "' - it is not hierarchical");
			hierarchyExists = true;
		}

		// record whether `hierarchy` is set anywhere in includes, so expansion of hierarchies can be skipped if their are none
		options.hierarchyExists = hierarchyExists || checkHierarchy(options, this);
	},
	afterFind: function(result, options) {
		// if no results, return
		if (!result) return;

		// if no hierarchies to expand anywhere in tree of includes, return
		if (!options.hierarchyExists) return;

		var parent;

		// where called from getDescendents, find id of parent
		if (options.hierarchy && options.includeMap) {
			var include = options.includeMap[this.hierarchy.through.name];

			if (include && include._pseudo && include.where && include.where[this.hierarchy.throughForeignKey]) {
				parent = {dataValues: {}};
				parent[this.primaryKeyAttribute] = include.where[this.hierarchy.throughForeignKey];
			}
		}

		// convert hierarchies into trees
		convertHierarchies(result, options, this, parent);
	}
};

function checkHierarchy(options, model) {
	var Sequelize = model.sequelize.Sequelize;

	// check options do not include illegal hierarchies - throw error if so
	if (!options.include) return;

	var hierarchyExists = false;
	options.include.forEach(function(include) {
		var includeModel = include.model;

		// if hierarchy set, check is legal
		if (include.hierarchy) {
			if (!includeModel.hierarchy) throw new Sequelize.SequelizeHierarchyError("You cannot get hierarchy of '" + includeModel.name + "' - it is not hierarchical");
			if (includeModel !== model) throw new Sequelize.SequelizeHierarchyError("You cannot get a hierarchy of '" + includeModel.name + "' without including it from a parent");
			if (include.as !== model.hierarchy.descendentsAs) throw new Sequelize.SequelizeHierarchyError("You cannot set hierarchy on '" + model.name + "' without using the '" + model.hierarchy.descendentsAs + "' accessor");
			hierarchyExists = true;
		}

		// check includes
		hierarchyExists = hierarchyExists || checkHierarchy(include, includeModel);
	});

	return hierarchyExists;
}

function convertHierarchies(results, options, model, parent) {
	if (!results) return;

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

function convertHierarchy(results, model, parent) {
	var hierarchy = model.hierarchy,
		primaryKey = model.primaryKeyAttribute,
		foreignKey = hierarchy.foreignKey,
		childrenAccessor = hierarchy.childrenAs,
		descendentsAccessor = hierarchy.descendentsAs,
		throughAccessor = hierarchy.through.name;

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
