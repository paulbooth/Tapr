//elephantconnect
var apiKey = '274721802648600';
var secretKey = 'ea8f8666766d34029bb8750139078ba8';

var PORT_NUMBER = 3550;
var hostUrl = 'http://thepaulbooth.com:' + PORT_NUMBER;

var express = require('express'),
    app = express();

var https = require('https'), http = require('http');

// ME MONGO ME STORE DATA
var mongo = require('mongodb'),
  Server = mongo.Server,
  Connection = mongo.Connection,
  Db = mongo.Db;
var mongo_host = process.env['MONGO_NODE_DRIVER_HOST'] != null ? process.env['MONGO_NODE_DRIVER_HOST'] : 'localhost';
var mongo_port = process.env['MONGO_NODE_DRIVER_PORT'] != null ? process.env['MONGO_NODE_DRIVER_PORT'] : Connection.DEFAULT_PORT;

console.log("Connecting to mongo at " + mongo_host + ":" + mongo_port);
var db = new Db('taprdb', new Server(mongo_host, mongo_port, {}), {safe:false});

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
    res.redirect('/login'); // Start the auth flow
    return;
  }

  var locals = {user: req.session.user};
  console.log("id at /: " + req.session.user.id);
  findMatches(req.session.user.id, function(matches) {
    locals.matches = matches;
    console.log("LOCALS HERE:");
    console.log(locals);
    console.log("Matches:");
    console.log(JSON.stringify(matches, undefined, 2));
    res.render('index.jade', locals);
  })
});

app.get('/tap', function(req, res) {
  if (!req.session.access_token) {
    res.redirect('/login');
    return;
  }
  addTap(req.session.user.id, (new Date()).getTime(), function() {
    res.redirect('/');
  });
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
    res.redirect('/login'); // go home to start the auth process again
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
    res.redirect('/login');
    return;
  }
  var fbLogoutUri = 'https://www.facebook.com/logout.php?next=' + hostUrl + '/&access_token=' + req.session.access_token
  req.session.user = null;
  req.session.access_token = null;
  res.redirect(fbLogoutUri);
});

app.get('/taps', function(req, res) {
  db.open(function(err, db) {
    db.collection('taps', function(err, collection) {
      collection.find( function(err, cursor) {
        var result = "taps:";
        cursor.each(function(err, item) {
          if(item != null) {
            console.dir(item);
            //console.log("created at " + new Date(item._id.generationTime) + "\n")
            result += "\n" + item.id + ":" + item.tap;
          }
          // Null signifies end of iterator
          if(item == null) {
            db.close();
            res.setHeader('Content-Type', 'text/plain');
            res.send(result);
          }
        });
      });          
    });
  });
});

app.get('/users', function(req, res) {
  db.open(function(err, db) {
    db.collection('users', function(err, collection) {
      collection.find( function(err, cursor) {
        var result = "users:";
        cursor.each(function(err, item) {
          if(item != null) {
            console.dir(item);
            //console.log("created at " + new Date(item._id.generationTime) + "\n")
            result += "\n" + item.id;
          }
          // Null signifies end of iterator
          if(item == null) {
            db.close();
            res.setHeader('Content-Type', 'text/plain');
            res.send(result);
          }
        });
      });          
    });
  });
});

app.listen(PORT_NUMBER);


function findMatches(id, callback) {
  console.log ("trying to find matches for " + id);
  findTaps(id, function(mytaps) {
    console.log("" + id + " has the following taps:" + mytaps);
    if (!mytaps.length) {
      callback([]);
      return;
    }
    db.open(function(err, db) {
      db.collection('users', function(err, collection) {
        collection.find(function(err, cursor) {
          var matches = [];
          cursor.each(function(err, item) {
            if(item != null && item.id != id) {
              //console.dir(item);
              //console.log("created at " + new Date(item._id.generationTime) + "\n")
              //matches += "\n" + item.uid + ":" + item.access_token;
              findTaps(item.id, function(taps) {
                console.log("Found taps for id " + id + ":" + taps);
                if (taps.length) {
                  var score = getMatchScore(mytaps, taps);
                  matches.push({score: score, item: item });
                }
              })
              
            }
            // Null signifies end of iterator
            if(item == null) {
              db.close();
              matches = matches.sort(function(a, b) { return a.score - b.score;})
              callback(matches);
            }
          });
        });          
      });
    });
  });
}

function addTap(id, tap, callback) {
  addUser(id, function() { 
    db.open(function(err, db) {
      db.collection('taps', function(err, collection) {        
        collection.insert({'id':id, 'tap':tap});
        console.log("added tap " + id + ":" + tap);
        db.close();
        callback();
      });
    });
  });
}

function addUser(id, callback) {
  db.open(function(err, db) {
    db.collection('users', function(err, collection) {
      collection.find(function(err, cursor) {
        var alreadyStored = false;
        cursor.each(function(err, item) {
          if(item != null) {
            alreadyStored = true;
            console.log("User exists:" + id);
          }
          // Null signifies end of iterator
          if(item == null) {
            if (!alreadyStored) {
              collection.insert({'id':id});
              console.log("Added user:" + id);
            }
            db.close();
            callback();
          }
        });
      });
    });
  });
}

function findTaps(id, callback) {
  db.open(function(err, db) {
    db.collection('taps', function(err, collection) {
      collection.find({'id': id}, function(err, cursor) {
        var taps = [];
        cursor.each(function(err, item) {
          if(item != null) {
            console.dir(item);
            //console.log("created at " + new Date(item._id.generationTime) + "\n")
            //taps += "\n" + item.uid + ":" + item.access_token;
            taps.push(item.tap);
          }
          // Null signifies end of iterator
          if(item == null) {
            db.close();
            callback(taps);
          }
        });
      });          
    });
  });
}

function getMatchScore(taps1, taps2) {

  l = Math.min(taps1.length, taps2.length);
  score = 0;
  for (var i = 0; i < l; i++) {
    var tap1 = taps1[taps1.length - i],
      tap2 = taps2[taps2.length - i];
    score = Math.abs(tap1 - tap2);
  }
  return score;
}


function DTWDistance(s, t) {
    n = s.length; m = t.length;

    // declare int DTW[0..n, 0..m]
    // declare int i, j, cost

    // for i := 1 to m
    //     DTW[0, i] := infinity
    // for i := 1 to n
    //     DTW[i, 0] := infinity
    // DTW[0, 0] := 0

    // for i := 1 to n
    //     for j := 1 to m
    //         cost:= d(s[i], t[j])
    //         DTW[i, j] := cost + minimum(DTW[i-1, j  ],    // insertion
    //                                     DTW[i  , j-1],    // deletion
    //                                     DTW[i-1, j-1])    // match

    // return DTW[n, m]
}