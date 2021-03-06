var User = require("../app/models/user");
var Maps = require("../app/models/maps");
var HighScores = require("../app/models/highscores");
var ResetPassword = require("../app/models/resetpassword");

var path = require("path");
var jwt = require("jsonwebtoken");
// var ExpressBrute = require('express-brute');
// var store = new ExpressBrute.MemoryStore();
// var bruteforce = new ExpressBrute(store);
var nodemailer = require("nodemailer");

module.exports = function (app, passport) {
  app.post(
    "/login",
    function (req, res) {
      passport.authenticate("local-login", function (err, user, info) {
        if (!user) {
          res.send(info);
        } else {
          req.logIn(user, function () {
            return res.redirect("/profile");
          });
        }
      })(req, res);
    }

    //   passport.authenticate('local-login', {
    //   failureRedirect: '/',
    //   successRedirect: '/profile'
    // })
  );

  app.post("/signup", function (req, res, next) {
    passport.authenticate("local-signup", function (err, user, info, status) {
      if (err) {
        return next(err);
      } else if (!user) {
        res.send(info);
      } else {
        // send Email
        var mailOptions = {
          from: '"Blinky" <communication.vrpacman@gmail.com>',
          to: user.email,
          subject: "Confirm registration for VR Pacman",
          text: `Hi ${user.username}!\n\nPlease verify your account by clicking the following link: ${process.env.MAIL_USER}/verifyemail?unique=${user.token}\n\nIf you believe you have received this email in error, please ignore this email.`,
        };

        transporter.sendMail(mailOptions, function (error, info) {
          if (error) {
            return console.log(error);
          }
        });

        // send back a json web token upon successful signup
        // var token = user.token;
        // var username = user.username

        // res.send({username: username, token: token});
        res.end();
      }
    })(req, res, next);
  });

  app.get("/profileInfo", isLoggedIn, function (req, res) {
    var result = {};
    var id = req.session.passport.user.id || req.session.passport.user[0].id;
    User.findOne({
      where: {
        id: id,
      },
      raw: true,
    }).then(function (user) {
      if (!user) {
        res.json({ success: false });
      } else {
        result.user = user;
      }

      HighScores["spHighScores_PC"].findAll({}).then(function (scores) {
        var sorted = scores.sort(function (a, b) {
          return b.score - a.score;
        });
        result.spHighScores_PC = sorted[0].score;
        HighScores["mpHighScores_PC"].findAll({}).then(function (mpScores) {
          var sortedMp = mpScores.sort(function (a, b) {
            return b.score - a.score;
          });
          result.mpHighScores_PC = sortedMp[0].score;
          result.success = true;
          res.json(result);
        });
      });
    });
  });

  app.post("/maps", isLoggedIn, function (req, res) {
    Maps.create({
      mapData: req.body.mapData,
      shareable: req.body.shareable,
      user_id: req.session.passport.user.id,
    }).then(function () {
      res.end();
    });
  });

  app.get("/maps", isLoggedIn, function (req, res) {
    // if (!checkToken) {
    //   res.sendStatus(403).send('Not authenticated')
    // }
    var getMaps = {};
    Maps.findAll({
      where: { shareable: true },
    }).then(function (publicMaps) {
      getMaps[0] = publicMaps;
      Maps.findAll({
        where: { user_id: req.session.passport.user.id },
      }).then(function (userMaps) {
        getMaps[1] = userMaps;
        res.send(getMaps);
      });
    });
  });

  /* For ranked room assignments, there are two options a user can encounter. Either (1) there is no element in the waitingRoom array and a random room number is generated and joined or (2) there is a waiting room and it is joined, shifted from waiting room, and added to roomsInPlay object.
  In the case that a user leaves a waiting room before another user joins, the room will be spliced from the waiting room and not added to rooms in play */

  var waitingRoomRanked = [];
  var roomsInPlayRanked = {};
  app.get(
    "/assignGameRoomRanked",
    function (req, res) {
      if (waitingRoomRanked.length === 0) {
        var generateRandomRoom = function () {
          var num = Math.ceil(Math.random() * 1000000000);
          if (roomsInPlayRanked[num]) {
            return generateRandomRoom();
          } else {
            return num;
          }
        };
        var randomRoomNumber = generateRandomRoom();
        waitingRoomRanked.push(randomRoomNumber);
        res.send(randomRoomNumber.toString());
      } else if (waitingRoomRanked.length > 0) {
        var roomNumber = waitingRoomRanked.shift();
        roomsInPlayRanked[roomNumber] = 2;
        res.send(roomNumber.toString());
      }
      // res.send(roomNumber.toString());
    }.bind(this)
  );

  app.post("/leaveGameRoomRanked", function (req, res) {
    var roomNumber = req.body.room.slice(4);
    var username = req.session.passport.user.username;
    if (roomsInPlayRanked[roomNumber]) {
      roomsInPlayRanked[roomNumber]--;
      if (roomsInPlayRanked[roomNumber] <= 0) {
        delete roomsInPlayRanked[roomNumber];
      }
    } else if (!roomsInPlayRanked[roomNumber]) {
      waitingRoomRanked.forEach(function (room, idx) {
        if (room === Number(roomNumber)) {
          waitingRoomRanked.splice(idx, 1);
        }
      });
    }
    res.end();
  });

  var customRooms = {};
  app.post("/createCustomRoom", function (req, res) {
    var roomName = req.body.room;
    if (!customRooms[roomName]) {
      customRooms[roomName] = 1;
      res.send("created");
    } else if (customRooms[roomName]) {
      res.send("taken");
    }
  });

  app.get("/joinCustomRoom", function (req, res) {
    var roomName = req.query.room;
    if (!customRooms[roomName]) {
      res.send("not found");
    } else if (customRooms[roomName] && customRooms[roomName] === 1) {
      customRooms[roomName]++;
      res.send("joined");
    } else if (customRooms[roomName] && customRooms[roomName] >= 2) {
      res.send("room full");
    }
  });

  app.post("/leaveGameRoomCustom", function (req, res) {
    var roomNumber = req.body.room.slice(4);
    var username = req.session.passport.user.username;
    customRooms[roomNumber]--;
    if (customRooms[roomNumber] <= 0) {
      delete customRooms[roomNumber];
    }
    res.end();
  });

  app.get("/joinCustomRoom", function (req, res) {});

  app.post("/leaveGameRoomCustom", function (req, res) {
    var roomNumber = req.body.room.slice(4);
    var username = req.session.passport.user.username;
  });

  app.post("/submitScore", isLoggedIn, function (req, res) {
    var table = req.body.table;
    var score = Number(req.body.score);
    var id = req.session.passport.user.id;
    HighScores[table]
      .create({
        user_id: id,
        score: score,
        username: req.session.passport.user.username,
      })
      .then(function () {
        res.send("Score posted!");
      });
  });

  app.get("/highScoreTable", function (req, res) {
    var table = req.query.table;
    HighScores[table].findAll({ raw: true, limit: 5 }).then(function (arr) {
      var sorted = arr.sort(function (a, b) {
        return b.score - a.score;
      });
      res.send(sorted);
    });
  });

  app.post("/updateMyHighScores", isLoggedIn, function (req, res) {
    User.findOne({
      where: {
        user_id: req.session.passport.user.id,
      },
      raw: true,
    }).then(function (user) {
      var table = req.body.table;
      // compare user.table high score with req.body.score
      if (req.body.score > user[table]) {
        User.update(
          { [table]: req.body.score },
          {
            where: { username: req.session.passport.user.username },
          }
        );
      }
      res.send(user);
    });
  });

  app.post("/updateMyMapSharing", isLoggedIn, function (req, res) {
    var myMaps = req.body.apiPackage;
    myMaps.forEach(function (entry) {
      Maps.update(
        { shareable: entry.shareable },
        {
          where: {
            user_id: req.session.passport.user.id,
            mapData: entry.mapData,
          },
        }
      ).error(function () {
        console.log("error updating");
        res.sendStatus(404).send("Error updating my mazes");
      });
    });
    res.send("My mazes publicity options have been updated!");
  });

  app.get("/logout", function (req, res) {
    req.logout();
    res.redirect("/");
  });

  app.get("/verifyemail", function (req, res) {
    console.log(req.query);
    var token = req.query.unique;
    jwt.verify(token, process.env.SECRET, function (err, decoded) {
      if (err) {
        return "Sorry, your link is no longer valid. Please verify link within 2 days of signup.";
      } else {
        console.log("decoded:", decoded);
        var username = decoded.unique.username;
        var email = decoded.unique.email;
        User.findOne({
          where: { username: username, email: email, token: token },
        }).then(function (user) {
          if (!user) {
            res.send(
              "Sorry, your link is no longer valid. Please verify link within 2 days of signup."
            );
          } else {
            console.log("user:", user);
            user.update({ active: true });
            res.redirect("/");
          }
        });
      }
    });
  });

  app.post("/forgotPassword", function (req, res) {
    var email = req.body.email;
    var token = jwt.sign({ email }, process.env.SECRET, {
      expiresIn: "15m", // expires in 15 minutes
    });
    ResetPassword.create({
      email: email,
      token: token,
    }).then(function (temp) {
      if (!temp) {
        res.send("Error");
      } else {
        setTimeout(function (temp) {
          temp.destroy();
        }, 96000); // 16 minutes, destroy entry
        res.send({ token: token });
      }
    });
    // create 15m token using email
    // save into a reset password table
    // send email that contains link to ajax request that grabs cookie token
    var mailOptions = {
      from: '"Blinky" <communication.vrpacman@gmail.com>',
      to: email,
      subject: "Reset password for VR Pacman",
      text: `Click the following link to reset your password: ${process.env.MAIL_USER}/resetpassword?unique=${token}\n\nIf you believe you have received this email in error, please ignore this email.`,
    };

    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        return console.log(error);
      }
      console.log("Message sent:", info.messageId, info.response);
    });
  });

  app.get("/resetpasswordaccess", function (req, res) {
    // see if inside database
    var token = req.query.token;
    jwt.verify(token, process.env.SECRET, function (err, decoded) {
      if (err) {
        res.send(err);
      } else {
        console.log("decoded:", decoded);
        // check database token active
        ResetPassword.findOne({
          where: {
            email: decoded.email,
            token: token,
          },
          raw: true,
        }).then(function (activeToken) {
          if (!activeToken) {
            res.send({ access: false });
          } else {
            res.send({ access: true });
          }
        });
      }
    });
  });

  app.post("/resetpassword", function (req, res) {
    var email = req.body.email;
    var password = User.generateHash(req.body.password);
    // update record
    User.findOne({ where: { email: email } }).then(function (user) {
      if (!user) {
        res.sendStatus(500);
      } else {
        user.update({ password: password });
        res.sendStatus(200);
      }
    });
  });

  app.get(
    "/auth/facebook",
    passport.authenticate("facebook", { scope: ["email"] })
  );

  app.get(
    "/auth/facebook/callback",
    passport.authenticate("facebook", { failureRedirect: "/" }),
    function (req, res) {
      res.redirect("/profile");
    }
  );
  app.get(
    "/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
  );

  app.get(
    "/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/" }),
    function (req, res) {
      // Successful authentication, redirect home.
      res.redirect("/profile");
    }
  );

  app.get("/verifyAuth", function (req, res) {
    if (req.isAuthenticated()) {
      res.json({ success: true });
    } else {
      res.json({ success: false });
    }
  });

  app.get("*", function (req, res) {
    res.sendFile(path.join(__dirname, "../client/index.html"));
  });
};

if (process.env.TYPE === "DEVELOPMENT") {
  var transporter = nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.CLIENT_USER,
      pass: process.env.CLIENT_PASS,
    },
  });
} else if (process.env.TYPE === "PRODUCTION") {
  var transporter = nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      type: "OAuth2",
      user: process.env.MAIL_USER,
      clientId: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      refreshToken: process.env.REFRESH_TOKEN,
      accessToken: process.env.ACCESS_TOKEN,
    },
  });
}

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  } else {
    res.redirect("/");
  }
}
