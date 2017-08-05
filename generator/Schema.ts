import mongoose = require("mongoose");

const _ = require('lodash');
const pluralize = require("pluralize");

enum PrimiteTypes {
  Object = "Object",
  Array = "Array",
  Date = "Date",
  String = "String",
  Boolean = "Boolean",
  Number = "Number",
  Mixed = "Mixed",
  ObjectId = "ObjectId",
  AutoPrimaryKey = "AutoPrimaryKey",
};

export class PrimiteType {
  constructor(
    public label: string,
    public type: PrimiteTypes,

    public items: PrimiteType[],
    public properties: { [s: string]: PrimiteType; },

    public enums: string[],
    public labels: string[],

    public defaults: any,
  ) {

  }

  static fromJSON(json: PrimiteType): PrimiteType {

    if (json.type === undefined) {
      console.error(json);
      throw new Error("PrimiteType: type is required");
    }

    if (!(json.type in PrimiteTypes)) {
      console.error(json);
      throw new Error(`PrimiteType[${json.type}]: type is invalid`);
    }

    if (json.type != PrimiteTypes.Object && json.label === undefined) {
      console.error(json);
      throw new Error("PrimiteType: label is required");
    }


    if (json.type == PrimiteTypes.Array) {
      for (let i = 0; i < json.items.length; ++i) {
        json.items[i] = PrimiteType.fromJSON(json.items[i]);
      }
    } else {
      json.items = null;
    }

    if (json.type == PrimiteTypes.Object) {
      // now cast every property
      for (let i in json.properties) {
        json.properties[i] = PrimiteType.fromJSON(json.properties[i]);
      }
    } else {
      json.properties = null;
    }

    return new PrimiteType(
      json.label,
      json.type,
      json.items,
      json.properties,
      json.enums || null,
      json.labels || null,
      json.defaults || null,
    );
  }

  getTypeScriptType() {
    switch (this.type) {
      case PrimiteTypes.AutoPrimaryKey:
        return PrimiteTypes.Number;
      case PrimiteTypes.Array:
        return "any[]";
      default:
        return this.type;
    }
  }

  getMongooseType() {
    switch (this.type) {
      case PrimiteTypes.AutoPrimaryKey:
        return PrimiteTypes.Number;
      case PrimiteTypes.Array:
        return "[]";
      default:
        return this.type;
    }
  }
};

export class PermissionsAllowed {
  constructor(
    public label: string = null,
    public allowed: boolean = false,
  ) {

  }

  static fromJSON(json: any = null): PermissionsAllowed {
    if (json) {
      return new PermissionsAllowed(
        json.label || null,
        json.allowed === true,
      );
    }
    return new PermissionsAllowed(); // defaults
  }
}

export class Permissions {
  read: PermissionsAllowed = new PermissionsAllowed();
  list: PermissionsAllowed = new PermissionsAllowed();
  create: PermissionsAllowed = new PermissionsAllowed();
  update: PermissionsAllowed = new PermissionsAllowed();
  delete: PermissionsAllowed = new PermissionsAllowed();

  constructor(
    read: PermissionsAllowed,
    list: PermissionsAllowed,
    create: PermissionsAllowed,
    update: PermissionsAllowed,
    _delete: PermissionsAllowed,
  ) {
    this.read = read;
    this.list = list;
    this.create = create;
    this.update = update;
    this.delete = _delete;
  }

  static fromJSON(json): Permissions {
    return new Permissions(
      PermissionsAllowed.fromJSON(json.read),
      PermissionsAllowed.fromJSON(json.list),
      PermissionsAllowed.fromJSON(json.create),
      PermissionsAllowed.fromJSON(json.update),
      PermissionsAllowed.fromJSON(json.delete),
    );
  }
};

export class BackEndSchema {
  parentSchema: Schema;
  //TODO mongoose.xxx ?
  options: {
    collection: string
  } = null;

  permissions: Permissions = null;

  schema: { [s: string]: PrimiteType; }  = null;

  createFunction: string;
  readFunction: string;
  listFunction: string;
  updateFunction: string;
  deleteFunction: string;
  routerName: string;

  constructor(json, parentSchema: Schema) {
    this.parentSchema = parentSchema;

    if (json.permissions === undefined) {
      throw new Error("BackEndSchema: permissions is required");
    }

    if (json.schema === undefined) {
      throw new Error("BackEndSchema: schema is required");
    }

    this.options = json.options || {};
    this.options.collection = this.parentSchema.plural;
    this.permissions = Permissions.fromJSON(json.permissions);
    this.schema = json.schema;
    // now cast every property
    for (let i in this.schema) {
      this.schema[i] = PrimiteType.fromJSON(this.schema[i]);
    }

    this.createFunction = `create${this.parentSchema.singularUc}`;
    this.readFunction = `read${this.parentSchema.singularUc}`;
    this.listFunction = `list${this.parentSchema.singularUc}`;
    this.deleteFunction = `destroy${this.parentSchema.singularUc}`;
    this.updateFunction = `update${this.parentSchema.singularUc}`;
    this.routerName = `router${this.parentSchema.singularUc}`;


  }
};

export class FrontEndSchema {
  parentSchema: Schema;

  createComponent: string;
  listComponent: string;
  updateComponent: string;

  constructor(json, parentSchema: Schema) {
    this.parentSchema = parentSchema;

    this.createComponent = `Create${this.parentSchema.singularUc}Component`;
    this.listComponent = `List${this.parentSchema.singularUc}Component`;
    this.updateComponent = `Update${this.parentSchema.singularUc}Component`;

  }
}


export class Schema {
  singular: string;
  singularUc: string;
  plural: string;
  entityId: string;

  interfaceName: string;
  interfaceModel: string;
  typeName: string;
  schemaName: string;
  modelName: string;

  backend: BackEndSchema;
  frontend: FrontEndSchema;

  module: string;

  constructor() {
    this._ = _;
  }

  static fromJSON(json: any): Schema {
    const schema = new Schema();
    if (json.singular === undefined) {
      throw new Error("Schema: singular is required");
    }

    if (json.backend === undefined) {
      throw new Error("Schema: backend is required");
    }

    schema.singular = json.singular;
    schema.plural = json.plural || pluralize(schema.singular);

    schema.modelName = schema.singularUc = schema.singular[0].toLocaleUpperCase() + schema.singular.substring(1);
    schema.interfaceName = "I" + schema.singularUc;
    schema.interfaceModel = "I" + schema.singularUc + "Model";
    schema.typeName = schema.singularUc + "Type";
    schema.entityId = schema.singular + "Id";
    schema.schemaName = schema.singularUc + "Schema";

    schema.module = schema.plural[0].toLocaleUpperCase() + schema.plural.substring(1) + "Module";

    schema.backend = new BackEndSchema(json.backend, schema);
    schema.frontend = new FrontEndSchema(json.frontend || {}, schema);

    return schema;
  }

  // helper for templates
  _:any; // lodash
  ucFirst = function(str): string {
    return str[0].toLocaleUpperCase() + str.substring(1);
  }
}
