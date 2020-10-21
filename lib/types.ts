/* eslint-ignore */

import {
	FindOptions,
	HasManyAddAssociationMixin,
	HasManyGetAssociationsMixin,
	HasManyRemoveAssociationMixin,
	Model,
} from 'sequelize';

interface HierarchyFindOptions extends FindOptions {
	hierarchy?: boolean;
}

interface IsHierarchyOptions {
	// as: Name of parent association. Defaults to 'parent'.
	as?: string;
	// childrenAs: Name of children association. Defaults to 'children'.
	childrenAs?: string;
	// ancestorsAs: Name of ancestors association. Defaults to 'ancestors'.
	ancestorsAs?: string;
	// descendentsAs: Name of descendents association. Defaults to 'descendents'.
	descendentsAs?: string;
	// primaryKey: Name of the primary key. Defaults to model's primaryKeyAttribute.
	primaryKey?: string;
	// foreignKey: Name of the parent field. Defaults to 'parentId'.
	foreignKey?: string;
	// levelFieldName: Name of the hierarchy depth field. Defaults to 'hierarchyLevel'.
	levelFieldName?: string;
	// freezeTableName: When true, through table name is same as through model name.
	// Inherits from sequelize define options.
	freezeTableName?: boolean;
	// throughSchema: Schema of hierarchy (through) table. Defaults to model.options.schema, and is optional.
	throughSchema?: string;
	// through: Name of hierarchy (through) model. Defaults to '<model name>ancestor'.
	through?: string;
	// throughTable: Name of hierarchy (through) table. Defaults to '<model name plural>ancestors'.
	throughTable?: string;
	// throughKey: Name of the instance field in hierarchy (through) table. Defaults to '<model name>Id'.
	throughKey?: string;
	// throughForeignKey: Name of the ancestor field in hierarchy (through) table. Defaults to 'ancestorId'.
	throughForeignKey?: string;
	// camelThrough: When true, through model name and table name are camelized (i.e. folderAncestor not folderancestor).
	// Inherits from sequelize define options.
	camelThrough?: boolean;
	// labels: When true, creates an attribute label on the created parentId and hierarchyLevel fields
	// which is a human-readable version of the field name. Inherits from sequelize define options or false.
	labels?: boolean;
}

export class HierarchyModel<T extends Model, PrimaryKeyType = string> extends Model {
	/* Only available when in the query `hierarchy` is `true` */
	public children?: T[];
	public descendants?: T[];

	public addChild!: HasManyAddAssociationMixin<T, PrimaryKeyType>;
	public removeChild!: HasManyRemoveAssociationMixin<T, PrimaryKeyType>
	public getChildren!: HasManyGetAssociationsMixin<T>;
	public getParent!: HasManyGetAssociationsMixin<T>;

	// @ts-ignore implemented by JS code
	public static isHierarchy<T>(options: IsHierarchyOptions): T;

	// @ts-ignore implemented by JS code
	public static findAll<T extends Model>(
		this: { new (): T } & typeof Model,
		options?: HierarchyFindOptions
	): Promise<T[]>;
}
