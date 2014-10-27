// --------------------
// Sequelize hierarchy
// Utility functions
// --------------------

// modules
var _ = require('lodash');

// exports

module.exports = {
	replaceIdentifiers: function(sql, identifiers) {
		_.forIn(identifiers, function(replacement, identifier) {
			sql = sql.replace(new RegExp('\\*' + identifier + '(?![a-zA-Z0-9])', 'g'), escapeIdentifier(replacement));
		});
		return sql.replace(/[ \t\r\n]+/g, ' ');
	}
};
	
function escapeIdentifier(identifier) {
	return '`' + identifier.replace(/`/g, '``') + '`';
}
