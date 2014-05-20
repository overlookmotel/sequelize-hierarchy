// --------------------
// Sequelize hierarchy
// extended model methods
// --------------------

// modules
var shimming = require('shimming');

// imports
var hooks = require('./hooks')

// exports

module.exports = function(Sequelize) {
	var Utils = Sequelize.Utils;
	var _ = Utils._;
	hooks = hooks(Sequelize);
	
	// return extended methods
	return {
		isHierarchy: function(options) {
			// set up options
			if (!options) options = {};
			
			_.defaults(options, {
				as: 'Parent',
				childsAs: 'Childs',
				ancestorsAs: 'Ancestors',
				descendentsAs: 'Descendents',
				levelFieldName: 'hierarchyLevel',
				levelFieldType: Sequelize.INTEGER.UNSIGNED,
				onDelete: (options.onDelete || 'restrict').toLowerCase()
			});
			
			_.defaults(options, {
				foreignKey: options.as + _.capitalize(this.primaryKeyAttribute),
				throughKey: this.name + _.capitalize(this.primaryKeyAttribute),
				throughForeignKey: Utils.singularize(options.ancestorsAs, this.options.language) + _.capitalize(this.primaryKeyAttribute),
				through: Utils.pluralize(this.name, this.options.language) + Utils.singularize(options.ancestorsAs, this.options.language)
			});
			
			if (['restrict', 'cascade'].indexOf(options.onDelete) == -1) throw new Error('onDelete on hierarchies must be either \'restrict\' or \'cascade\'');
			
			// record hierarchy in model
			this.hierarchy = options;
			
			// create associations
			this.hasMany(this, {as: options.childsAs, foreignKey: options.foreignKey, onDelete: options.onDelete});
			this.belongsTo(this, {as: options.as, foreignKey: options.foreignKey});
			
			// add level field to model
			this.rawAttributes[options.levelFieldName] = {type: options.levelFieldType};
			this.init(this.daoFactoryManager);
			
			// create through table
			var sequelize = this.sequelize;
			
			var throughFields = {};
			var throughField = {type: this.rawAttributes[this.primaryKeyAttribute].type, allowNull: false};
			throughFields[options.throughKey] = throughField;
			throughFields[options.throughForeignKey] = throughField;
			options.through = sequelize.define(options.through, throughFields, {timestamps: false});
			
			// create associations through join table
			this.hasMany(this, {
				as: options.ancestorsAs,
				foreignKey: options.throughForeignKey,
				through: options.through
			});
			
			this.hasMany(this, {
				as: options.descendentsAs,
				foreignKey: options.throughKey,
				through: options.through
			});
			
			// apply hooks
			_.forIn(hooks, function(hookFn, hookName) {
				this.hook(hookName, hookFn);
			}.bind(this));
			
			// apply shim for bulkCreate
			shimming.shim(this, {
				bulkCreate: bulkCreateShim,
				update: bulkUpdateShim
			});
			
			// return this for chaining
			return this;
		}
	};
	
	function bulkCreateShim(originalFn, records, fieldsOrOptions, options)
	{
		// combine fieldsOrOptions and options
		if (!options) options = {};
		if (fieldsOrOptions instanceof Array) {
			options.fields = fieldsOrOptions;
		} else {
			options.fields = options.fields || Object.keys(this.attributes);
			options = _.extend(options, fieldsOrOptions);
	    }

		// set hooks = true so that beforeCreate and afterCreate hooks fire
		options.hooks = true;

		// run original function
		return originalFn(records, options);
	}
	
	function bulkUpdateShim(originalFn, attrValueHash, where, options)
	{
		// set hooks = true so that beforeUpdate and afterUpdate hooks fire
		if (!options) options = {};
		options.hooks = true;

		// run original function
		return originalFn(attrValueHash, where, options);
	}
};
