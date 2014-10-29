// --------------------
// Sequelize hierarchy
// Utility functions
// --------------------

// modules
var _ = require('lodash');

// exports

module.exports = {
	replaceIdentifiers: function(sql, identifiers, sequelize) {
		_.forIn(identifiers, function(replacement, identifier) {
			sql = sql.replace(new RegExp('\\*' + identifier + '(?![a-zA-Z0-9])', 'g'), sequelize.queryInterface.quoteIdentifier(replacement));
		});
		return sql.replace(/[ \t\r\n]+/g, ' ');
	}
};
