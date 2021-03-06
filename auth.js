/**
 * Module dependencies.
 */
var passport = require('passport')
  , LocalStrategy = require('passport-local').Strategy
  , BasicStrategy = require('passport-http').BasicStrategy
  , ClientPasswordStrategy = require('passport-oauth2-client-password').Strategy
  , BearerStrategy = require('passport-http-bearer').Strategy
  , db = require('./db')
  , when = require('promised-io/promise').when
  , bcrypt = require('bcrypt')
  , md5 = require("md5")
  , DataModel = require("./dataModel");


/**
 * LocalStrategy
 *
 * This strategy is used to authenticate users based on a username and password.
 * Anytime a request is made to authorize an application, we must ensure that
 * a user is logged in before asking them to approve the request.
 */
passport.use(new LocalStrategy(
  function(username, password, done) {
	console.log("LocalStrategry Verify()");
	console.log("Login Username: ", username);
    when(DataModel.get("user").get(username),function(user){
	if (!user) {
		return done(false);
	}
	console.log("Login Check for: ", user.id, user.password, password);
	if (user.password == md5(password)) {
		return done(null, user);
	}else {
		bcrypt.compare(password,user.password, function(err,res){
			if (err) { return done(err); }
			if (res) {
				return done(null,user);
			}
			return done(null,false);
		})
	}
    }, function(err){
	console.log("Error Retrieving User: ", err);
	if (err){
		return done(err);
	}
	done(null,false);
    });
  }
));

passport.serializeUser(function(user, done) {
//  console.log("serialize User: ", user);
  done(null, user.id || user);
});

passport.deserializeUser(function(id, done) {
    when(DataModel.get("user").get(id),function(user){
	return done(null,user);
    }, function(err){
	if (err){
		return done(err);
	}
	done(null,false);
    });

});


/**
 * BasicStrategy & ClientPasswordStrategy
 *
 * These strategies are used to authenticate registered OAuth clients.  They are
 * employed to protect the `token` endpoint, which consumers use to obtain
 * access tokens.  The OAuth 2.0 specification suggests that clients use the
 * HTTP Basic scheme to authenticate.  Use of the client password strategy
 * allows clients to send the same credentials in the request body (as opposed
 * to the `Authorization` header).  While this approach is not recommended by
 * the specification, in practice it is quite common.
 */
passport.use(new BasicStrategy(
  function(username, password, done) {
	console.log("Basic Strategy: ", username, password);
    db.clients.findByClientId(username, function(err, client) {
      if (err) { return done(err); }
      if (!client) { return done(null, false); }
      if (client.clientSecret != password) { return done(null, false); }
      return done(null, client);
    });
  }
));

passport.use(new ClientPasswordStrategy(
  function(clientId, clientSecret, done) {
	console.log("ClientPasswordStrategy: ", clientId, clientSecret);
    db.clients.findByClientId(clientId, function(err, client) {
      if (err) { return done(err); }
      if (!client) { return done(null, false); }
      if (client.clientSecret != clientSecret) { return done(null, false); }
      return done(null, client);
    });
  }
));

/**
 * BearerStrategy
 *
 * This strategy is used to authenticate either users or clients based on an access token
 * (aka a bearer token).  If a user, they must have previously authorized a client
 * application, which is issued an access token to make requests on behalf of
 * the authorizing user.
 */
passport.use(new BearerStrategy(
  function(accessToken, done) {
	console.log("BearerStrategy: ", accessToken);
    db.accessTokens.find(accessToken, function(err, token) {
      if (err) { return done(err); }
      if (!token) { return done(null, false); }
	console.log("token.userID: ", token.userID);
      if(token.userID != null) {
	console.log("bearer strat with userID", token.userID);
          db.users.find(token.userID, function(err, user) {
              if (err) { return done(err); }
              if (!user) { return done(null, false); }
              // to keep this example simple, restricted scopes are not implemented,
              // and this is just for illustrative purposes
              var info = { scope: '*' }
              done(null, user, info);
          });
      } else {
		console.log("clientOnly bearer strategy");
          //The request came from a client only since userID is null
          //therefore the client is passed back instead of a user
          db.clients.findByClientId(token.clientID, function(err, client) {
             if(err) { return done(err); }
              if(!client) { return done(null, false); }
              // to keep this example simple, restricted scopes are not implemented,
              // and this is just for illustrative purposes
              var info = { scope: '*' }
              done(null, client, info);
          });
      }
    });
  }
));
