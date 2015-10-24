// --------------------
// Sequelize hierarchy
// Extended model methods
// --------------------

// modules
var _ = require('lodash');

// imports
var utils = require('./utils'),
	patchesFn = require('./patches'),
	hooksModelFn = require('./hooksModel');

// exports

module.exports = function(Sequelize) {
	var patches = patchesFn(Sequelize),
		hooksModel = hooksModelFn(Sequelize);

	return {
		isHierarchy: function(options) {
			var sequelize = this.sequelize,
				Sequelize = sequelize.Sequelize,
				Utils = Sequelize.Utils;

			// set up options
			if (!options || options === true) options = {};

			var globalOptions = sequelize.options.define || {};

			options = _.extend({
				as: 'parent',
				childrenAs: 'children',
				ancestorsAs: 'ancestors',
				descendentsAs: 'descendents',
	            primaryKey: this.primaryKeyAttribute,
				levelFieldName: 'hierarchyLevel',
				//foreignKeyAttributes: undefined,
				//levelFieldAttributes: undefined,
				levelFieldType: (['postgres', 'mssql'].indexOf(sequelize.options.dialect) != -1) ? Sequelize.INTEGER : Sequelize.INTEGER.UNSIGNED,
				freezeTableName: globalOptions.freezeTableName || false,
				camelThrough: globalOptions.camelThrough || false,
				labels: globalOptions.labels || false
			}, sequelize.options.hierarchy || {}, options);

			_.defaults(options, {
				foreignKey: options.as + Utils.uppercaseFirst(options.primaryKey),
				throughKey: this.name + Utils.uppercaseFirst(options.primaryKey),
				throughForeignKey: Utils.singularize(options.ancestorsAs) + Utils.uppercaseFirst(options.primaryKey),
				through: this.name + Utils.singularize(options.camelThrough ? Utils.uppercaseFirst(options.ancestorsAs) : options.ancestorsAs)
			});

			_.defaults(options, {
				throughTable: options.freezeTableName ? options.through : (Utils.pluralize(this.name) + (options.camelThrough ? Utils.uppercaseFirst(options.ancestorsAs) : options.ancestorsAs))
			});

			options.onDelete = (options.onDelete || 'RESTRICT').toUpperCase();
			if (['RESTRICT', 'CASCADE'].indexOf(options.onDelete) == -1) throw new Sequelize.HierarchyError("onDelete on hierarchies must be either 'RESTRICT' or 'CASCADE'");

			// record hierarchy in model
			this.hierarchy = options;

			// add level field to model
			var levelFieldDefinition = {type: options.levelFieldType};
			if (options.levelFieldAttributes) _.extend(levelFieldDefinition, options.levelFieldAttributes);

			this.attributes[options.levelFieldName] = levelFieldDefinition;
			this.init(this.modelManager);

			// create associations
			this.hasMany(this, {as: options.childrenAs, foreignKey: options.foreignKey, onDelete: options.onDelete});
			this.belongsTo(this, {as: options.as, foreignKey: options.foreignKey});

			// add foreignKey attributes
			if (options.foreignKeyAttributes) _.extend(this.attributes[options.foreignKey], options.foreignKeyAttributes);

			// create labels
			if (options.labels) {
				[options.levelFieldName, options.foreignKey].forEach(function(fieldName) {
					var field = this.attributes[fieldName];
					if (field.label === undefined) field.label = utils.humanize(fieldName);
				}.bind(this));
			}

			// create through table
			var throughFields = {};
			throughFields[options.throughKey] = {type: this.attributes[options.primaryKey].type, allowNull: false, primaryKey: true};
			throughFields[options.throughForeignKey] = {type: this.attributes[options.primaryKey].type, allowNull: false, primaryKey: true};

			if (options.labels) {
				_.forIn(throughFields, function(field, fieldName) {
					field.label = utils.humanize(fieldName);
				});
			}

			options.through = sequelize.define(options.through, throughFields, {timestamps: false, paranoid: false, tableName: options.throughTable, schema: options.throughSchema});

			// create associations through join table
			this.belongsToMany(this, {
				as: options.descendentsAs,
				foreignKey: options.throughForeignKey,
				through: options.through
			});

			this.belongsToMany(this, {
				as: options.ancestorsAs,
				foreignKey: options.throughKey,
				through: options.through
			});

			// remove ancestor and descendent setters
			['set', 'add', 'addMultiple', 'create', 'remove', 'removeMultiple'].forEach(function(accessorType) {
				delete this.Instance.prototype[this.associations[options.ancestorsAs].accessors[accessorType]];
				delete this.associations[options.ancestorsAs].accessors[accessorType];
				delete this.Instance.prototype[this.associations[options.descendentsAs].accessors[accessorType]];
				delete this.associations[options.descendentsAs].accessors[accessorType];
			}.bind(this));

			// apply hooks
			_.forIn(hooksModel, function(hookFn, hookName) {
				this.addHook(hookName, hookFn);
			}.bind(this));

			// return this for chaining
			return this;
		},

		rebuildHierarchy: function(options) {
			if (!options) options = {};

			var model = this,
				hierarchy = this.hierarchy,
				primaryKey = hierarchy.primaryKey,
				foreignKey = hierarchy.foreignKey,
				throughKey = hierarchy.throughKey,
				throughForeignKey = hierarchy.throughForeignKey,
				levelFieldName = hierarchy.levelFieldName,
				through = hierarchy.through;

			// truncate hierarchy through table
			return through.destroy(utils.addOptions({truncate: true}, options))
			.then(function() {
				// go up tree level by level and set hierarchy level field + create hierarchy through table records
				var updateAttr = {};
				updateAttr[levelFieldName] = 0;

				return (function processLevel(parents) {
					// find next level (i.e. children of last batch)
					var where = {};
					where[foreignKey] = parents ? parents.map(function(item) {return item.id;}) : null;

					return patches.findAll(model, utils.addOptions({where: where, attributes: [primaryKey, foreignKey]}, options))
					.then(function(items) {
						if (!items.length) return;

						// update hierarchy level
						updateAttr[levelFieldName]++;

						return model.update(updateAttr, utils.addOptions({where: where}, options))
						.then(function() {
							// add hierarchy path to newItems from items + create array for inserting into through table
							var ancestors = [];

							items = items.map(function(item) {
								var itemId = item[primaryKey];
								var parentId = item[foreignKey];
								var parent = parentId !== null ? _.find(parents, {id: parentId}) : {path: []};

								item = {id: itemId, path: _.clone(parent.path)};

								item.path.forEach(function(ancestorId) {
									var ancestor = {};
									ancestor[throughKey] = itemId;
									ancestor[throughForeignKey] = ancestorId;

									ancestors.push(ancestor);
								});

								item.path.push(itemId);

								return item;
							});

							// insert rows into hierarchy through table
							return through.bulkCreate(ancestors, utils.addOptions({}, options))
							.then(function() {
								return processLevel(items);
							});
						});
					});
				})();
			})
			// return this for chaining
			.return(this);
		}
	};
};
