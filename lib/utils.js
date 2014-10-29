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
	
	// string format conversion from camelCase to human-readable format
	// e.g. 'fooBar' -> 'Foo Bar'
	humanize: function(str) {
		return str[0].toUpperCase() + str.slice(1).replace(/([A-Z])/g, ' $1');
	}
};
