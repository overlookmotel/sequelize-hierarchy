// --------------------
// Sequelize hierarchy
// Extended model methods
// --------------------

// imports
var hooksModel = require('./hooksModel')

// exports

module.exports = function(Sequelize) {
	var Utils = Sequelize.Utils,
		_ = Utils._,
		hooks = hooksModel(Sequelize);
	
	// return extended methods
	return {
		isHierarchy: function(options) {
			// set up options
			if (!options) options = {};
			
			options = _.extend({
				as: 'parent',
				childrenAs: 'children',
				ancestorsAs: 'ancestors',
				descendentsAs: 'descendents',
				levelFieldName: 'hierarchyLevel',
				levelFieldType: Sequelize.INTEGER.UNSIGNED
			}, options);
			
			_.defaults(options, {
				foreignKey: options.as + Utils.uppercaseFirst(this.primaryKeyAttribute),
				throughKey: this.name + Utils.uppercaseFirst(this.primaryKeyAttribute),
				throughForeignKey: Utils.singularize(options.ancestorsAs, this.options.language) + Utils.uppercaseFirst(this.primaryKeyAttribute),
				through: Utils.pluralize(this.name, this.options.language) + Utils.uppercaseFirst(options.ancestorsAs)
			});
			
			options.onDelete = (options.onDelete || 'RESTRICT').toUpperCase();
			if (['RESTRICT', 'CASCADE'].indexOf(options.onDelete) == -1) throw new Error('onDelete on hierarchies must be either \'RESTRICT\' or \'CASCADE\'');
			
			// record hierarchy in model
			this.hierarchy = options;
			
			// add level field to model
			this.rawAttributes[options.levelFieldName] = {type: options.levelFieldType};
			this.init(this.daoFactoryManager);
			
			// create associations
			this.hasMany(this, {as: options.childrenAs, foreignKey: options.foreignKey, onDelete: options.onDelete});
			this.belongsTo(this, {as: options.as, foreignKey: options.foreignKey});
			
			// create through table
			// NB this follows Sequelize's convention of naming the through model in plural,
			// even though inconsistent with usual Sequelize behaviour
			var sequelize = this.sequelize;
			
			var throughFields = {};
			throughFields[options.throughKey] = {type: this.rawAttributes[this.primaryKeyAttribute].type, allowNull: false, primaryKey: true};
			throughFields[options.throughForeignKey] = {type: this.rawAttributes[this.primaryKeyAttribute].type, allowNull: false, primaryKey: true};
			options.through = sequelize.define(options.through, throughFields, {timestamps: false, paranoid: false, tableName: options.through});
			
			// create associations through join table
			this.hasMany(this, {
				as: options.descendentsAs,
				foreignKey: options.throughForeignKey,
				through: options.through
			});
			
			this.hasMany(this, {
				as: options.ancestorsAs,
				foreignKey: options.throughKey,
				through: options.through
			});
			
			// remove ancestor and descendent setters
			['set', 'add', 'addMultiple', 'create', 'remove'].forEach(function(accessorType) {
				delete this.Instance.prototype[this.associations[options.ancestorsAs].accessors[accessorType]];
				delete this.associations[options.ancestorsAs].accessors[accessorType];
				delete this.Instance.prototype[this.associations[options.descendentsAs].accessors[accessorType]];
				delete this.associations[options.descendentsAs].accessors[accessorType];
			}.bind(this));
			
			// apply hooks
			_.forIn(hooks, function(hookFn, hookName) {
				this.addHook(hookName, hookFn);
			}.bind(this));
			
			// return this for chaining
			return this;
		},
		
		rebuildHierarchy: function() {
			var model = this,
				hierarchy = this.hierarchy,
				primaryKey = this.primaryKeyAttribute,
				foreignKey = hierarchy.foreignKey,
				throughKey = hierarchy.throughKey,
				throughForeignKey = hierarchy.throughForeignKey,
				levelFieldName = hierarchy.levelFieldName,
				through = hierarchy.through;
			
			// truncate hierarchy through table
			return through.destroy({}, {truncate: true})
			.then(function() {
				// go up tree level by level and set hierarchy level field + create hierarchy through table records
				var updateAttr = {};
				updateAttr[levelFieldName] = 0;
				
				return (function processLevel(parents) {
					// find next level (i.e. children of last batch)
					var where = {};
					where[foreignKey] = parents ? parents.map(function(item) {return item.id;}) : null;
					
					return model.findAll({where: where, attributes: [primaryKey, foreignKey]}, {raw: true})
					.then(function(items) {
						if (!items.length) return;
						
						// update hierarchy level
						updateAttr[levelFieldName]++;
						
						return model.update(updateAttr, {where: where})
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
							return through.bulkCreate(ancestors)
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
