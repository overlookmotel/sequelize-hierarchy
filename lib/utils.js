/* --------------------
 * Sequelize hierarchy
 * Utility functions
 * ------------------*/

'use strict';

// Modules
const _ = require('lodash'),
	isGeneratorFunction = require('is-generator').fn;
const bluebird = require('bluebird');

// Exports

module.exports = {
	removeSpacing,
	replaceFieldNames,
	replaceTableNames,
	humanize,
	addOptions,
	inFields,
	valueFilteredByFields,
	addToFields,
	makeCo
};

// Remove spacing from SQL
function removeSpacing(sql) {
	return sql.replace(/[ \t\r\n]+/g, ' ').trim();
}

// Replace field names in SQL marked with * with the identifier text quoted.
// e.g. SELECT *field FROM `Tasks` with identifiers {field: 'name'}
// -> SELECT `name` FROM `Tasks`
function replaceFieldNames(sql, identifiers, model) {
	const {queryInterface} = model.sequelize;
	_.forIn(identifiers, (fieldName, identifier) => {
		// Get table field name for model field
		fieldName = (model.rawAttributes || model.attributes)[fieldName].field;

		// Replace identifiers
		sql = sql.replace(
			new RegExp(`\\*${identifier}(?![a-zA-Z0-9_])`, 'g'),
			queryInterface.queryGenerator.quoteIdentifier(fieldName)
		);
	});
	return sql;
}

// Replace identifier with model's full table name taking schema into account
function replaceTableNames(sql, identifiers, sequelize) {
	const {queryInterface} = sequelize;
	_.forIn(identifiers, (model, identifier) => {
		const tableName = model.getTableName();
		sql = sql.replace(
			new RegExp(`\\*${identifier}(?![a-zA-Z0-9_])`, 'g'),
			tableName.schema ? tableName.toString() : queryInterface.queryGenerator.quoteIdentifier(tableName)
		);
	});
	return sql;
}

// String format conversion from camelCase or underscored format to human-readable format
// e.g. 'fooBar' -> 'Foo Bar', 'foo_bar' -> 'Foo Bar'
function humanize(str) {
	if (str == null || str === '') return '';
	str = `${str}`.replace(
		/[-_\s]+(.)?/g,
		(match, c) => (c ? c.toUpperCase() : '')
	);
	return str[0].toUpperCase() + str.slice(1).replace(/([A-Z])/g, ' $1');
}

// Add transaction and logging from options to query options
function addOptions(queryOptions, options) {
	const {transaction, logging} = options;
	if (transaction !== undefined) queryOptions.transaction = transaction;
	if (logging !== undefined) queryOptions.logging = logging;
	return queryOptions;
}

// Check if field is in `fields` option
function inFields(fieldName, options) {
	const {fields} = options;
	if (!fields) return true;
	return fields.includes(fieldName);
}

// Get field value if is included in `options.fields`
function valueFilteredByFields(fieldName, item, options) {
	if (!inFields(fieldName, options)) return null;
	return item.dataValues[fieldName];
}

// Add a field to `options.fields`.
// NB Clones `options.fields` before adding to it, to avoid options being mutated externally.
function addToFields(fieldName, options) {
	if (inFields(fieldName, options)) return;
	options.fields = options.fields.concat([fieldName]);
}

// Return `co` and `coAll` functions, using `Sequelize.Promise` (i.e. Bluebird)
function makeCo(Sequelize) {
	const co = bluebird.coroutine;

	function coAll(obj) {
		_.forIn(obj, (value, key) => {
			if (isGeneratorFunction(value)) obj[key] = co(value);
		});
		return obj;
	}

	return {co, coAll};
}
