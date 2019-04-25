/* --------------------
 * Sequelize hierarchy
 * Hooks on all models
 * ------------------*/

'use strict';

// Modules
const _ = require('lodash');

// Exports

module.exports = (Sequelize, patches) => {
	const {HierarchyError} = Sequelize,
		{attributes, isModelInstance, uppercaseFirst} = patches;

	return {
		afterDefine(model) {
			// Get hierarchy option
			let {hierarchy} = model.options;

			// Check for hierarchy set on a field
			_.forIn(attributes(model), (field, fieldName) => {
				if (!field.hierarchy) return;

				if (hierarchy) {
					throw new HierarchyError(`You cannot define hierarchy on two attributes, or an attribute and the model options, in '${model.name}'`);
				}

				hierarchy = field.hierarchy;
				if (hierarchy === true) hierarchy = {};

				// Deduce foreignKey and as for the hierarchy from field name
				hierarchy.foreignKey = fieldName;
				const primaryKey = hierarchy.primaryKey || model.primaryKeyAttribute;
				if (!hierarchy.as) {
					if (_.endsWith(fieldName, uppercaseFirst(primaryKey))) {
						hierarchy.as = fieldName.slice(0, -primaryKey.length);
					} else if (_.endsWith(fieldName, `_${primaryKey}`)) {
						hierarchy.as = fieldName.slice(0, -primaryKey.length - 1);
					} else {
						hierarchy.as = fieldName;
					}
				}

				model.options.hierarchy = hierarchy;
				field.hierarchy = true;
			});

			// If hierarchy set, init hierarchy
			if (hierarchy) model.isHierarchy(hierarchy);
		},

		beforeFindAfterExpandIncludeAll(options) {
			// Check options do not include illegal hierarchies
			let hierarchyExists = false;
			if (options.hierarchy) {
				if (!this.hierarchy) throw new HierarchyError(`You cannot get hierarchy of '${this.name}' - it is not hierarchical`);
				hierarchyExists = true;
			}

			// Record whether `hierarchy` is set anywhere in includes, so expansion of
			// hierarchies can be skipped if their are none
			options.hierarchyExists = hierarchyExists || checkHierarchy(options, this);
		},

		afterFind(result, options) {
			// If no results, return
			if (!result) return;

			// If no hierarchies to expand anywhere in tree of includes, return
			if (!options.hierarchyExists) return;

			let parent;

			// Where called from getDescendents, find id of parent
			if (options.hierarchy && options.includeMap) {
				const include = options.includeMap[this.hierarchy.through.name];

				if (include && include.where) {
					const parentId = include.where[this.hierarchy.throughForeignKey];
					if (parentId) parent = {[this.hierarchy.primaryKey]: parentId};
				}
			}

			// Convert hierarchies into trees
			convertHierarchies(result, options, this, parent);

			// Where called from getDescendents, retrieve result from parent.children
			if (parent) {
				result.length = 0;
				result.push(...parent[this.hierarchy.childrenAs]);
			}
		}
	};

	function checkHierarchy(options, model) {
		// Check options do not include illegal hierarchies - throw error if so
		if (!options.include) return undefined;

		let hierarchyExists = false;
		for (const include of options.include) {
			const includeModel = include.model;

			// If hierarchy set, check is legal
			if (include.hierarchy) {
				if (!includeModel.hierarchy) {
					throw new HierarchyError(`You cannot get hierarchy of '${includeModel.name}' - it is not hierarchical`);
				}
				// Use model names rather than model references to compare,
				// as Model.scope() results in a new model object.
				if (includeModel.name.singular !== model.name.singular) {
					throw new HierarchyError(`You cannot get a hierarchy of '${includeModel.name}' without including it from a parent`);
				}
				if (include.as !== model.hierarchy.descendentsAs) {
					throw new HierarchyError(`You cannot set hierarchy on '${model.name}' without using the '${model.hierarchy.descendentsAs}' accessor`);
				}

				hierarchyExists = true;
			}

			// Check includes
			hierarchyExists = hierarchyExists || checkHierarchy(include, includeModel);
		}

		return hierarchyExists;
	}

	function convertHierarchies(results, options, model, parent) {
		if (!results) return;

		// Convert hierarchies into trees
		if (options.include) {
			for (const include of options.include) {
				const includeModel = include.model,
					accessor = include.as;

				if (!Array.isArray(results)) results = [results];

				for (const result of results) {
					convertHierarchies(result[accessor], include, includeModel, result);
				}
			}
		}

		if (options.hierarchy) convertHierarchy(results, model, parent);
	}

	function convertHierarchy(results, model, parent) {
		const {hierarchy} = model,
			{primaryKey, foreignKey} = hierarchy,
			childrenAccessor = hierarchy.childrenAs,
			descendentsAccessor = hierarchy.descendentsAs,
			throughAccessor = hierarchy.through.name;

		// Get parent ID and create output array
		let parentId, output;
		if (parent) {
			parentId = parent[primaryKey];

			// Remove parent.descendents and create empty parent.children array
			output = [];
			setValue(parent, childrenAccessor, output);
			deleteValue(parent, descendentsAccessor);
		} else {
			parentId = null;

			// Duplicate results array and empty output array
			output = results;
			results = results.slice();
			output.length = 0;
		}

		// Run through all results, turning into tree

		// Create references object keyed by id
		const references = {};
		for (const item of results) {
			// TODO Make keys strings for faster lookup
			references[item[primaryKey]] = item;
		}

		// Run through results, transferring to output array or nesting within parent
		for (const item of results) {
			// Remove reference to through table
			deleteValue(item, throughAccessor);

			// If top-level item, add to output array
			const thisParentId = item[foreignKey];
			if (thisParentId === parentId) {
				output.push(item);
				continue;
			}

			// Not top-level item - nest inside parent
			const thisParent = references[thisParentId];
			if (!thisParent) {
				throw new HierarchyError(`Parent ID ${thisParentId} not found in result set`);
			}

			let parentChildren = thisParent[childrenAccessor];
			if (!parentChildren) {
				parentChildren = [];
				setValue(thisParent, childrenAccessor, parentChildren);
			}

			parentChildren.push(item);
		}
	}

	function setValue(item, key, value) {
		item[key] = value;
		if (isModelInstance(item)) item.dataValues[key] = value;
	}

	function deleteValue(item, key) {
		delete item[key];
		if (isModelInstance(item)) delete item.dataValues[key];
	}
};
