//elephantconnect
var apiKey = '274721802648600';
var secretKey = 'ea8f8666766d34029bb8750139078ba8';

var PORT_NUMBER = 3550;
var hostUrl = 'http://thepaulbooth.com:' + PORT_NUMBER;

var express = require('express'),
    app = express();

var https = require('https'), http = require('http');

// For cookies! So each person who connects is not all the same person
var MemoryStore = require('connect').session.MemoryStore;
app.use(express.cookieParser());
app.use(express.session({ secret: "tapr", store: new MemoryStore({ reapInterval:  60000 * 10 })}));

app.set('views', __dirname + '/views');
app.use(express.static(__dirname + '/public'));

// The page for tapr
app.get('/', function(req, res) {
  if (!req.session.access_token) {
    console.log("NO ACCESS TOKEN AT /")
    res.redirect('/'); // Start the auth flow
    return;
  }

  var locals = {user: req.session.user};
  console.log("LOCALS HERE:");
  console.log(locals);
  res.render('index.jade', locals);
});

app.get('/tap', function(req, res) {
  if (!req.session.access_token) {
    res.redirect('/login');
    return;
  }
  res.redirect('/');
});

// First part of Facebook auth dance
app.get('/login', function(req, res){
  var redirect_url = 'https://www.facebook.com/dialog/oauth?client_id=' + apiKey +
   '&redirect_uri=' + hostUrl + '/perms' +
   '&scope=publish_actions&state=authed'
  // console.log("REDIRECTIN' From /")
  // console.log(redirect_url);
  // console.log("REQUEST HEADERS:" + JSON.stringify(req.headers));
  res.redirect(redirect_url);
});

// Second part of Facebook auth dance
app.get('/perms', function(req, res){
  var state = req.query['state'];
  var code = req.query['code'];
  // console.log("req.query:" + JSON.stringify(req.query))
  // console.log("hit /perms")
  // console.log("Code:");
  // console.log(code);
  if (state == 'authed') {
    console.log('sick. Facebook PERMED us.')
    var redirect_path = '/oauth/access_token?' +
    'client_id=' + apiKey +
    '&redirect_uri=' + hostUrl + '/perms' +
    '&client_secret=' + secretKey +
    '&code=' + code;// + '&destination=chat';
    var options = {
      host: 'graph.facebook.com',
      port: 443,
      path: redirect_path
    };

    https.get(options, function(fbres) {
      // console.log('STATUS: ' + fbres.statusCode);
      // console.log('HEADERS: ' + JSON.stringify(fbres.headers));
      var output = '';
      fbres.on('data', function (chunk) {
          output += chunk;
      });

      fbres.on('end', function() {
        console.log("ACCESS TOKEN RIGHT HERE");
        console.log(output);
        // parse the text to get the access token
        req.session.access_token = output.replace(/access_token=/,"").replace(/&expires=\d+$/, "");

        // console.log("ACCESS TOKEN:" + access_token)
        res.redirect('/basicinfo');
      });
    }).on('error', function(e) {
      console.log('ERROR: ' + e.message);
      console.log(redirect_path);
      console.log(JSON.stringify(e, undefined, 2))
    });
  } else {
    console.error("WHAT THE HECK WE AREN'T AUTHED?????? %s", state);
  }
});

// Gets the basic user info
app.get('/basicinfo', function(req, res) {
  if (!req.session.access_token) {
    console.log("NO ACCESS TOKEN AT Basic info.")
    res.redirect('/'); // go home to start the auth process again
    return;
  }
  var options = {
      host: 'graph.facebook.com',
      port: 443,
      path: '/me?access_token=' + req.session.access_token
    };
  https.get(options, function(fbres) {
    // console.log('CHATSTATUS: ' + fbres.statusCode);
    //   console.log('HEADERS: ' + JSON.stringify(fbres.headers));

      var output = '';
      fbres.on('data', function (chunk) {
          //console.log("CHUNK:" + chunk);
          output += chunk;
      });

      fbres.on('end', function() {
        req.session.user = JSON.parse(output);
        res.redirect('/');
      });
  });
});

app.get('/logout', function(req, res) {
  if (!req.session.access_token) {
    res.redirect('/');
    return;
  }
  var fbLogoutUri = 'https://www.facebook.com/logout.php?next=' + hostUrl + '/&access_token=' + req.session.access_token
  req.session.user = null;
  req.session.access_token = null;
  res.redirect(fbLogoutUri);
});

app.listen(PORT_NUMBER);
