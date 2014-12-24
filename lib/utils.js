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
			sql = sql.replace(new RegExp('\\*' + identifier + '(?![a-zA-Z0-9])', 'g'), sequelize.queryInterface.quoteIdentifier(replacement));
		});
		return sql.replace(/[ \t\r\n]+/g, ' ');
	},

	// string format conversion from camelCase or underscored format to human-readable format
	// e.g. 'fooBar' -> 'Foo Bar', 'foo_bar' -> 'Foo Bar'
	humanize: function(str) {
		if (str === null || str === undefined || str == '') return '';
		str = ('' + str).replace(/[-_\s]+(.)?/g, function(match, c) {return c ? c.toUpperCase() : '';}); // jshint ignore:line
		return str.slice(0, 1).toUpperCase() + str.slice(1).replace(/([A-Z])/g, ' $1');
	},

	// checks if str ends with needle
	endsWith: function(str, needle) {
		return str.slice(str.length - needle.length) == needle;
	}
};
