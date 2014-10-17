// --------------------
// Sequelize hierarchy
// Utility functions
// --------------------

// exports

module.exports = function(Sequelize) {
	var Utils = Sequelize.Utils,
		_ = Utils._;
	
	// return functions
	return {
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
};
