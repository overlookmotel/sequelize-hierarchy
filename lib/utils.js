// --------------------
// Sequelize hierarchy
// Utility functions
// --------------------

'use strict';

// modules
const _ = require('lodash');

// exports

const utils = {
	// replace field names in SQL marked with * with the identifier text quoted
	// e.g. SELECT *field FROM `Tasks` with identifiers {field: 'name'}
	// -> SELECT `name` FROM `Tasks`
	replaceFieldNames(sql, identifiers, model) {
		_.forIn(identifiers, (fieldName, identifier) => {
			// get table field name for model field
			fieldName = model.attributes[fieldName].field;

			// replace identifiers
			sql = sql.replace(
				new RegExp(`\\*${identifier}(?![a-zA-Z0-9_])`, 'g'), model.sequelize.queryInterface.quoteIdentifier(fieldName)
			);
		});
		return sql.replace(/[ \t\r\n]+/g, ' ');
	},

	// replace identifier with model's full table name taking schema into account
	replaceTableNames(sql, identifiers, sequelize) {
		_.forIn(identifiers, (model, identifier) => {
			const tableName = model.getTableName();
			sql = sql.replace(
				new RegExp(`\\*${identifier}(?![a-zA-Z0-9_])`, 'g'),
				tableName.schema
					? tableName.toString()
					: sequelize.queryInterface.quoteIdentifier(tableName)
			);
		});
		return sql;
	},

	// string format conversion from camelCase or underscored format to human-readable format
	// e.g. 'fooBar' -> 'Foo Bar', 'foo_bar' -> 'Foo Bar'
	humanize(str) {
		if (str === null || str === undefined || str === '') return '';
		str = `${str}`.replace(
			/[-_\s]+(.)?/g,
			(match, c) => (c ? c.toUpperCase() : '')
		);
		return str.slice(0, 1).toUpperCase() + str.slice(1).replace(/([A-Z])/g, ' $1');
	},

	// add transaction and logging from options to query options
	addOptions(queryOptions, options) {
		queryOptions.transaction = options.transaction;
		queryOptions.logging = options.logging;
		return queryOptions;
	},

	// check if field is in `fields` option
	inFields(fieldName, options) {
		if (!options.fields) return true;
		return _.includes(options.fields, fieldName);
	},

	// get field value if is included in `options.fields`
	valueFilteredByFields(fieldName, item, options) {
		if (!utils.inFields(fieldName, options)) return null;
		return item.dataValues[fieldName];
	},

	// add a field to `options.fields`
	// NB clones `options.fields` before adding to it, to avoid options being mutated externally
	addToFields(fieldName, options) {
		if (utils.inFields(fieldName, options)) return;
		options.fields = options.fields.concat([fieldName]);
	}
};

module.exports = utils;
