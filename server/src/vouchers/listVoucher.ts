import * as express from "express";
import { Request } from "../app";
//import { User } from './User';
import { WhereQuery, Order, Operators, Pagination, ListQueryParams } from "../common";

import { Voucher, VoucherSchema, IVoucherModel } from "../models/Voucher";

const _ = require("lodash");

//const ValidationError = mongoose.ValidationError;
//const csvWriter = require('csv-write-stream');
//const jsontoxml = require('jsontoxml');

export function createListQuery(
  /*user: User,*/
  where: { [s: string]: WhereQuery },
  sort: { [s: string]: Order },
  limit: number,
  offset: number,
  populate: string[],
  fields: string[],
  // TODO ): mongoose.DocumentQuery<IVoucher, mongoose.Document>[] {
): any[] {
  if (offset !== null && isNaN(offset)) {
    throw new Error("offset must be a number");
  }

  if (limit !== null && isNaN(limit)) {
    throw new Error("limit must be a number");
  }

  let query = Voucher.find({});
  let qCount = Voucher.find({}).count();

  /* TODO add restricted to where & sort
    if (isPathRestricted(path, 'read', user)) {
      err = new ValidationError(null);
      err.errors.sort = {
        path: 'query:sort',
        message: 'field is restricted',
*/

  where = _.map(where, (operator: WhereQuery, path: string) => {
    console.log(operator);

    switch (operator.operator) {
      case Operators.LIKE:
        query = query.where(path).regex(operator.value);
        qCount = qCount.where(path).regex(operator.value);
        break;
      default:
        query = query.where(path).equals(operator.value);
        qCount = qCount.where(path).equals(operator.value);
        break;
    }
  });

  sort = _.map(sort, (s: Order, key: string) => {
    const options = VoucherSchema.path(key);
    if (!options) {
      throw new Error("sort[" + key + "] not found");
    }

    return [key, s === Order.ASC ? Order.ASC : Order.DESC];
  });

  _.each(populate, (path: string) => {
    const options = VoucherSchema.path(path);
    if (!options) {
      throw new Error("populate[" + path + "] not found");
    }
    /*
    if (!isPathRestricted(options.options.type)) {
    if (!typeCanBePopulated(options.options.type)) {
      throw new Error("populate[" + s + "] can't be populated");
    }
    */
    query.populate(path);
  });

  console.log("where", where);
  console.log("sort", sort);
  console.log("limit", limit, "offset", offset);
  console.log("fields", fields);

  if (offset) {
    query.skip(offset);
  }

  if (limit) {
    query.limit(limit);
  }

  if (fields.length) {
    query.select(fields.join(" "));
  }

  // http://mongoosejs.com/docs/api.html#query_Query-sort
  query.sort(sort);

  return [query, qCount];
}

export function listVoucher(req: Request, res: express.Response, next: express.NextFunction) {
  const query: ListQueryParams = ListQueryParams.fromJSON(req.query);

  console.log("usersList", JSON.stringify(query));

  try {
    const querys = createListQuery(query.where, query.sort, query.limit, query.offset, query.populate, query.fields);

    querys[0].exec(function(err, mlist: IVoucherModel[]) {
      /* istanbul ignore next */ if (err) {
        return next(err);
      }

      return querys[1].exec(function(err2, count: number) {
        /* istanbul ignore next */ if (err2) {
          return next(err2);
        }

        req.vouchers = new Pagination<IVoucherModel>(mlist, count, query.offset, query.limit);

        return next();
      });
    });
  } catch (err) {
    next(err);
  }
}
