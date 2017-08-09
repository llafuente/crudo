import * as express from "express";
import * as bodyParser from "body-parser";
import { Pagination } from "./common";
import { HttpError } from "./HttpError";
const jwt = require('jsonwebtoken');
const expressJwt = require('express-jwt');
const cors = require('cors');

import { User } from './models/User';

<% _.each(generator.schemas, (schema) => { %>
import <%= schema.backend.routerName %> from './<%= schema.plural %>/<%= schema.backend.routerName %>';
import { <%= schema.interfaceModel %> } from './models/<%= schema.singularUc %>';
<% }) %>

// declare our own interface for request to save our variables
export interface Request extends express.Request {
  loggedUser: IUserModel;

<% _.each(generator.schemas, (schema) => { %>
<%= schema.singular %>: <%= schema.interfaceModel %>;
// <%= schema.plural %>: <%= schema.interfaceModel %>[];
<%= schema.plural %>: Pagination<<%= schema.interfaceModel %>>;
<% }) %>
};


const mongoose = require("mongoose");
mongoose.Promise = require("bluebird");
mongoose.set('debug', true);

mongoose.connect("mongodb://127.0.0.1:27017/test", {
  promiseLibrary: require("bluebird"),
  useMongoClient: true,
}, function(err) {
  if (err) {
    throw err;
  }

  console.log("connected to mongodb");
});

const app = express();

app.use(cors())

//use json form parser middlware
app.use(bodyParser.json());

//use query string parser middlware
app.use(bodyParser.urlencoded({
  extended: true
}));

// authentication layer
const secret = "sdkjksf8j2nsk87";
app.post('/users/auth', function(req: Request, res: express.Response, next: express.NextFunction) {
  User.findOne({
    userlogin: req.body.userlogin
  }, function(err, user) {
    /* istanbul ignore next */ if (err) {
      return next(err);
    }

    if (!user || !user.authenticate(req.body.password)) {
      return next(new HttpError(422, 'user not found or invalid pasword'));
    }

    return res.status(200).json({
      'token': jwt.sign({
        id: user._id.toString(),
        session_start: (new Date()).toString()
      }, secret)
    });
  });
})
//
// jwt
//
.use(expressJwt({
  secret: secret,
  credentialsRequired: false,
  // header: "Authorization: Bearer XXXXXX"
  getToken: function fromHeader(req) {
    if (req.headers.authorization) {
      const x = req.headers.authorization.split(' ');
      if (x[0] === 'Bearer') {
        return x[1];
      }
    }
    /*
    else if (req.query && req.query.access_token) {
      return req.query.access_token;
    }
    */
    return null;
  }
}))
.use(function(req: Request, res: express.Response, next: express.NextFunction) {
  if (!req.user || !req.user.id) {
    return next();
  }

  // move to user -> loggedUser
  req.loggedUser = req.user;
  delete req.user;

  console.log('regenerate session: ' + req.loggedUser.id.toString());

  return User.findOne({
    _id: req.loggedUser.id
  })
  .populate('roles')
  .exec(function(err, dbuser) {
    if (err || !dbuser) {
      return next(new HttpError(401, 'regenerate session failed'));
    }

    req.loggedUser = dbuser;
    console.log('user logged: ' + JSON.stringify(dbuser.toJSON()));
    return next();
  });
})
.post('/users/me', function(req: Request, res: express.Response, next: express.NextFunction) {
  // TODO check token
  if (!req.headers.authorization) {
    return next(new HttpError(401, 'no session'));
  }

  if (!req.loggedUser) {
    return next(new HttpError(401, 'invalid session'));
  }

  const u = req.loggedUser.toJSON();
  console.log(u);
  // TODO
  //user.$express.formatter(req, u, function(err, output) {
  //  res.status(200).json(output);
  //});

  return res.status(200).json(u);
});

// generated schemas routes


<% _.each(generator.schemas, (schema) => { %>
app.use(<%= schema.backend.routerName%>);
<% }) %>


app.use((req, res, next) => {
  res.status(404).json({error: true});
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(404).json({error: true});
});


if (process.env.NODE_ENV !== "test") {
  const port: number = process.env.PORT ? parseInt(process.env.PORT, 10) : 3004;
  console.log("listening at: 0.0.0.0:" + port);
  app.listen(port, "0.0.0.0");
}
