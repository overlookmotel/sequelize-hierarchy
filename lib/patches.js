// --------------------
// Sequelize hierarchy
// Patches to unify Sequlize versions 2.x.x, 3.x.x and 4.x.x
// --------------------

// modules
var semverSelect = require('semver-select');

var sequelizeVersionImported = require('sequelize/package.json').version;

// exports

// function to define patches
module.exports = function(Sequelize) {
    // get Sequelize version
    var sequelizeVersion = Sequelize.version || sequelizeVersionImported;

    // define patches
    return semverSelect.object(sequelizeVersion, {
        /*
         * Patches underscoredIf location differing in v2
         */
        underscoredIf: {
          '^2.0.0': Sequelize.Utils._.underscoredIf,
          '>=3.0.0': Sequelize.Utils.underscoredIf
        },
        /*
         * Patches to unify function signature changes between Sequelize v2 and v3
         */
        query: {
            '^2.0.0': function(sequelize, sql, options) {
                return sequelize.query(sql, null, options);
            },
            '>=3.0.0': function(sequelize, sql, options) {
                return sequelize.query(sql, options);
            }
        },
        find: {
            '^2.0.0': function(model, options) {
                return model.find(options, {transaction: options.transaction, logging: options.logging});
            },
            '>=3.0.0': function(model, options) {
                return model.find(options);
            }
        },
        findAll: {
            '^2.0.0': function(model, options) {
                return model.findAll(options, {transaction: options.transaction, logging: options.logging});
            },
            '>=3.0.0': function(model, options) {
                return model.findAll(options);
            }
        },
        truncate: {
            // workaround for bug in sequelize v2 with `truncate` option on models with schemas
            '^2.0.0': function(model, options) {
                if (model.sequelize.options.dialect == 'postgres' && model.options.schema) {
                    options.where = {};
                } else {
                    options.truncate = true;
                }
                return model.destroy(options);
            },
            '>=3.0.0': function(model, options) {
                options.truncate = true;
                return model.destroy(options);
            }
        },

        /*
         * In Sequelize v2 + v3:
         *   - models are instanceof Sequelize.Model
         *   - model instances are instanceof model.Instance
         *   - model.Instance is subclass of Sequelize.Instance
         *   - models instances have a property `.Model` referring to the model they are one of
         *
         * In Sequelize v4:
         *   - models are subclasses of Sequelize.Model
         *   - model instances are instanceof their Model + therefore also instanceof Sequelize.Model
         *   - Sequelize.Instance does not exist
         *
         * The patches below account for these changes.
         */
        modelConstructor: {
            '2.0.0 - 3.x.x': Sequelize.Model.prototype,
            '>=4.0.0': Sequelize.Model
        },
        isModelInstance: {
            '2.0.0 - 3.x.x': function(item) {
                return item instanceof Sequelize.Instance;
            },
            '>=4.0.0': function(item) {
                return item instanceof Sequelize.Model;
            }
        },
        instancePrototype: {
            '2.0.0 - 3.x.x': function(model) {
                return model.Instance.prototype;
            },
            '>=4.0.0': function(model) {
                return model.prototype;
            }
        },
        modelInit: {
            '2.0.0 - 3.x.x': function(model) {
                return model.init(model.modelManager);
            },
            '>=4.0.0': function() {}
        }
    });
};
