// --------------------
// Sequelize hierarchy
// Additional utility functions
// --------------------

// exports

module.exports = function(Sequelize) {
	var Utils = Sequelize.Utils;
	var _ = Utils._;
	
	// add extra methods
	
	_.extend(_, {
		uncapitalize: function(str)
		{
			str = str == null ? '' : String(str);
			return str.charAt(0).toLowerCase() + str.slice(1);
		}
	});
	
	// return Utils
	return Utils;
};
