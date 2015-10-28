// --------------------
// Sequelize hierarchy
// Utility functions
// --------------------

// modules
var _ = require('lodash');

// exports

module.exports = {
	// replace identifiers in SQL marked with * with the identifier text quoted
	// e.g. SELECT *field FROM *table with identifiers {field: 'name', table: 'Tasks}
	// -> SELECT `name` FROM `Tasks`
	replaceIdentifiers: function(sql, identifiers, sequelize) {
		_.forIn(identifiers, function(replacement, identifier) {
			sql = sql.replace(new RegExp('\\*' + identifier + '(?![a-zA-Z0-9_])', 'g'), sequelize.queryInterface.quoteIdentifier(replacement));
		});
		return sql.replace(/[ \t\r\n]+/g, ' ');
	},

	// replace identifier with model's full table name taking schema into account
	replaceTableNames: function(sql, identifiers, sequelize) {
		_.forIn(identifiers, function(model, identifier) {
			var tableName = model.getTableName();
			sql = sql.replace(new RegExp('\\*' + identifier + '(?![a-zA-Z0-9_])', 'g'), (tableName.schema ? tableName.toString() : sequelize.queryInterface.quoteIdentifier(tableName)));
		});
		return sql;
	},

	// string format conversion from camelCase or underscored format to human-readable format
	// e.g. 'fooBar' -> 'Foo Bar', 'foo_bar' -> 'Foo Bar'
	humanize: function(str) {
		if (str === null || str === undefined || str == '') return '';
		str = ('' + str).replace(/[-_\s]+(.)?/g, function(match, c) {return c ? c.toUpperCase() : '';}); // jshint ignore:line
		return str.slice(0, 1).toUpperCase() + str.slice(1).replace(/([A-Z])/g, ' $1');
	},

	// add transaction and logging from options to query options
	addOptions: function(queryOptions, options) {
		queryOptions.transaction = options.transaction;
		queryOptions.logging = options.logging;
		return queryOptions;
	}
};
