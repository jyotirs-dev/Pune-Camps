var express = require("express"),
    app = express(),
    methodOverride = require("method-override"),
    mongoose = require('mongoose'),
    bodyParser = require("body-parser"),
    flash = require('connect-flash'),
    passport = require("passport"),
    LocalStrategy = require("passport-local"),
    passportLocalMongoose = require("passport-local-mongoose"),
    async = require("async"),
    nodemailer = require("nodemailer"),
    nodemailerSendgrid = require('nodemailer-sendgrid'),
    crypto = require("crypto"),
    sgMail = require('@sendgrid/mail'),
    Camp = require("./models/campground"),
    Comment = require("./models/comment"),
    User = require("./models/users"),
    seedDB = require("./seeds");

mongoose.connect('mongodb://localhost/yelp_camp_DB', { useNewUrlParser: true });
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
app.use(methodOverride("_method"));
app.use(flash());


// seedDB();


// Camp.remove({
//     name: "New Camp"
// }, function(err, newcamp) {
//     if (err) { console.log(err) }
//     else { console.log(newcamp) };
// });

// var camps=[
//         {name:"Pawna",img:"https://pixabay.com/get/57e8d3444855a914f6da8c7dda793f7f1636dfe2564c704c73287dd59e4acc51_340.jpg"},
//         {name:"Lavasa" , img:"https://pixabay.com/get/50e9d4474856b108f5d084609620367d1c3ed9e04e50744f72297add9044cc_340.jpg"},
//         {name:"Lonavla", img:"https://pixabay.com/get/57e1d14a4e52ae14f6da8c7dda793f7f1636dfe2564c704c73287dd59e4acc51_340.jpg"},
//         {name:"Pawna",img:"https://pixabay.com/get/57e8d3444855a914f6da8c7dda793f7f1636dfe2564c704c73287dd59e4acc51_340.jpg"},
//         {name:"Lavasa" , img:"https://pixabay.com/get/50e9d4474856b108f5d084609620367d1c3ed9e04e50744f72297add9044cc_340.jpg"},
//         {name:"Lonavla", img:"https://pixabay.com/get/57e1d14a4e52ae14f6da8c7dda793f7f1636dfe2564c704c73287dd59e4acc51_340.jpg"}
//         ];

//==================================================================================================
//passport configuration
//==================================================================================================

app.use(require('express-session')({ secret: 'blue cat', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

// use static authenticate method of model in LocalStrategy
passport.use(new LocalStrategy(User.authenticate()));

// use static serialize and deserialize of model for passport session support
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(function(req, res, next) {
    res.locals.currentuser = req.user;
    res.locals.error = req.flash("error");
    res.locals.success = req.flash("success");
    next();
})

//===================================================================================================

app.get("/", function(req, res) {
    res.render("landing");
})

app.get("/campgrounds", function(req, res) {
    Camp.find({}, function(err, allcamps) {
        if (err) { console.log(err) }
        else {

            res.render("campgrounds/index", { camps: allcamps, currentuser: req.user });
        }
    })

})

//new campground post request
app.post("/campgrounds", function(req, res) {
    var name = req.body.campname;
    var img = req.body.campimage;
    var description = req.body.campdescription;
    var price = req.body.price;
    var author = { id: req.user._id, username: req.user.username };
    // console.log(req.body.campname);
    var newcamp = { name: name, img: img, price: price, description: description, author: author };
    Camp.create(newcamp, function(err, new_camp) {
        if (err) { console.log(err) }
        else {
            // console.log(new_camp)
            res.redirect("/campgrounds");
        }
    });



})
//new campground
app.get("/campgrounds/new", isLoggedIn, function(req, res) {
    res.render("campgrounds/new");
})

//show page
app.get("/campgrounds/:id", function(req, res) {
    Camp.findById(req.params.id).populate("comments").exec(function(err, found_camp) {
        if (err) {
            console.log(err);
        }
        else {
            // console.log(found_camp);
            res.render("campgrounds/show", { show_camp: found_camp, timeDifference: timeDifference });
        }
    })

})
//edit campground
app.get("/campgrounds/:id/edit", checkCampOwnership, function(req, res) {

    Camp.findById(req.params.id, function(err, found_camp) {
        if (err) {
            console.log(err)
        }
        else {
            res.render("campgrounds/edit", { show_camp: found_camp });
        }
    })



    // if (req.isAuthenticated()) {

    //     Camp.findById(req.params.id, function(err, found_camp) {
    //         console.log(found_camp.author.id)
    //         console.log(req.user._id)
    //         if (err) {
    //             console.log(err)
    //         }
    //         else {
    //             if (found_camp.author.id.equals(req.user._id)) {
    //                 res.render("campgrounds/edit", { show_camp: found_camp });
    //             }
    //             else {
    //                 res.send("you don't own this camp")
    //             }
    //         }
    //     })

    // }
    // else {
    //     res.send("you need to login")
    // }

})
//update campground
app.put("/campgrounds/:id", checkCampOwnership, function(req, res) {

    Camp.findByIdAndUpdate(req.params.id, req.body.editedcamp, function(err, updatedcamp) {
        if (err) {
            console.log(err)
            res.redirect("back");
        }
        else {
            // console.log(updatedcamp);
            res.redirect("/campgrounds/" + updatedcamp._id)
        }
    })
})

//delete camp
app.delete("/campgrounds/:id", checkCampOwnership, function(req, res) {
    Camp.findByIdAndRemove(req.params.id, function(err, campgroundRemoved) {
        if (err) {
            console.log(err);
        }
        else {
            Comment.deleteMany({ _id: { $in: campgroundRemoved.comments } }, (err) => {
                if (err) {
                    console.log(err);
                }
                res.redirect("/campgrounds");
            });

        }
    })

})


//==================
//Comments Route
//===============
app.get("/campgrounds/:id/comments/new", checkrepeatcomment, function(req, res) {
    Camp.findById(req.params.id, function(err, found_camp) {
        if (err) {
            console.log(err);
        }
        else {
            res.render("comments/new", { show_camp: found_camp });
        }

    })

})

app.post("/campgrounds/:id/comments", function(req, res) {
    // var text = req.body.commentname;
    // var author = req.body.authorname;
    // var newcomment = { text: text, author: author };

    // console.log(req.body.comment);
    Camp.findById(req.params.id, function(err, found_camp) {
        if (err) {
            console.log(err);
        }
        else {
            Comment.create(req.body.comments, function(err, comment) {
                if (err) {
                    console.log(err);
                }
                else {
                    //adding comment user details
                    comment.author.id = req.user._id;
                    comment.author.username = req.user.username;
                    //saving comments
                    comment.save();
                    found_camp.comments.push(comment);
                    found_camp.save();
                    // console.log("Created new comment");
                }
            });
            // console.log(found_camp);
            res.redirect("/campgrounds/" + found_camp.id);
        }
    });
});

//edit comments
app.get("/campgrounds/:id/comments/:comment_id/edit", checkCommentOwnership, function(req, res) {
    Camp.findById(req.params.id, function(err, found_camp) {
        if (err) {
            console.log(err);
        }
        else {
            Comment.findById(req.params.comment_id, function(err, found_comment) {
                if (err) {
                    console.log(err);
                }
                else {
                    res.render("comments/edit", { show_camp: found_camp, show_comment: found_comment });
                }

            })
        }

    })

})

//update comments
app.put("/campgrounds/:id/comments/:comment_id/edit", checkCommentOwnership, function(req, res) {

    Comment.findByIdAndUpdate(req.params.comment_id, req.body.editedcomment, function(err, editedcomment) {
        if (err) {
            console.log(err)
            res.redirect("back");
        }
        else {
            console.log(editedcomment);
            res.redirect("/campgrounds/" + req.params.id)
        }
    })
})

//delete comments
app.delete("/campgrounds/:id/comments/:comment_id", checkCommentOwnership, function(req, res) {
    Comment.findByIdAndRemove(req.params.comment_id, function(err, commentRemoved) {
        if (err) {
            console.log(err);
            res.redirect("back");
        }
        else {
            res.redirect("/campgrounds/" + req.params.id);
        }
    })
})

//===============
//Authentication Routes
//===================

app.get("/register", function(req, res) {
    if (req.isAuthenticated()) {
        res.redirect("/logout");
    }
    else {
        res.render("register");
    }
})

app.post("/register", function(req, res) {
    var newUser = new User({
        username: req.body.username,
        email: req.body.email,
    });

    if (req.isAuthenticated()) {
        req.logout();
        req.flash("success", "You have successfuly logged out");
        return res.redirect("/register");
    }
    User.register(newUser, req.body.password, function(err, user) {
        if (err) {
            console.log(err);
            req.flash('error', err.message);
            return res.redirect('register');

        }
        passport.authenticate("local")(req, res, function() {
            req.flash('success', 'Welcome to PuneCamps! ' + user.username);
            res.redirect("/campgrounds");
        });
    });
})


app.get("/login", function(req, res) {

    res.render("login");
})

//login logic
//middleware
app.post("/login", passport.authenticate("local", {
    successRedirect: "/campgrounds",
    failureRedirect: "/login",
    successFlash: "Hi Welcome back",
    failureFlash: "Incorrect username or password"
}), function(req, res) {});

app.get("/logout", function(req, res) {
    req.logout();
    req.flash("success", "You have successfuly logged out");
    res.redirect("/");
});

//changepassword
app.get("/change/:user", isLoggedIn, function(req, res) {
    res.render("users/change");
})

app.post("/change/:user", isLoggedIn, function(req, res) {
    User.findOne({ username: req.user.username }, function(err, loggeduser) {
        if (err) {
            console.log(err);
            req.flash('error', "No User Found");
            return res.redirect('/register');

        }
        else {
            loggeduser.changePassword(req.body.oldpassword, req.body.newpassword, function(err, user) {
                if (err) {
                    console.log(err);
                    req.flash('error', err.message);
                    return res.redirect('change/' + req.user.username);

                }
                else {
                    req.logout();
                    req.flash("success", "You have successfuly Changed Password! Please login again");
                    res.redirect("/");
                }
            })
        }
    })

})
//forgot password
app.get("/forgot", function(req, res) {
    res.render("forgot");
})

app.post('/forgot', function(req, res, next) {
    async.waterfall([
        function(done) {
            crypto.randomBytes(20, function(err, buf) {
                var token = buf.toString('hex');
                done(err, token);
            });
        },
        function(token, done) {
            User.findOne({ email: req.body.email }, function(err, user) {
                if (!user) {
                    req.flash('error', 'No account with that email address exists.');
                    return res.redirect('/forgot');
                }

                user.resetPasswordToken = token;
                user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

                user.save(function(err) {
                    done(err, token, user);
                });
            });
        },
        function(token, user, done) {
            const transporter = nodemailer.createTransport(
                nodemailerSendgrid({
                    apiKey: process.env.SENDGRID_API_KEY
                })
            );
            // var smtpTransport = nodemailer.createTransport('SMTP', {
            //     service: 'Gmail',
            //     auth: {
            //         user: 'jyotirsolanki@gmail.com',
            //         pass: 'goodnight13'
            //     }
            // });

            // sgMail.setApiKey(process.env.SENDGRID_API_KEY);


            var mailOptions = {
                to: user.email,
                from: 'passwordreset@example.com',
                subject: 'Node.js Password Reset',
                text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
                    'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
                    'http://' + req.headers.host + '/reset/' + token + '\n\n' +
                    'If you did not request this, please ignore this email and your password will remain unchanged.\n'
            };
            transporter.sendMail(mailOptions, function(err) {
                req.flash('success', 'An e-mail has been sent to ' + user.email + ' with further instructions.');
                done(err, 'done');
            });
        }
    ], function(err) {
        if (err) return next(err);
        res.redirect('/forgot');
    });
});

app.get('/reset/:token', function(req, res) {
    User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
        if (!user) {
            req.flash('error', 'Password reset token is invalid or has expired.');
            return res.redirect('/forgot');
        }
        res.render('reset', {
            token: req.params.token
        });
    });
});

app.post('/reset/:token', function(req, res) {
    async.waterfall([
        function(done) {
            User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
                if (!user) {
                    req.flash('error', 'Password reset token is invalid or has expired.');
                    return res.redirect('back');
                }

                if (req.body.password === req.body.confirm) {
                    user.setPassword(req.body.password, function(err) {
                        user.resetPasswordToken = undefined;
                        user.resetPasswordExpires = undefined;

                        user.save(function(err) {
                            req.logIn(user, function(err) {
                                done(err, user);
                            });
                        });
                    })
                }
                else {
                    req.flash("error", "Passwords do not match.");
                    return res.redirect('back');
                }


            });
        },
        function(user, done) {
            const transporter = nodemailer.createTransport(
                nodemailerSendgrid({
                    apiKey: process.env.SENDGRID_API_KEY
                })
            );
            var mailOptions = {
                to: user.email,
                from: 'passwordreset@example.com',
                subject: 'Your password has been changed',
                text: 'Hello,\n\n' +
                    'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
            };
            transporter.sendMail(mailOptions, function(err) {
                req.flash('success', 'Success! Your password has been changed.');
                done(err);
            });
        }
    ], function(err) {
        res.redirect('/');
    });
});


//===================
//middleware
//==============

function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    req.flash('error', 'You need to login first!');
    res.redirect("/login");
}

function checkCampOwnership(req, res, next) {
    if (req.isAuthenticated()) {

        Camp.findById(req.params.id, function(err, found_camp) {

            if (err || !found_camp) {
                req.flash('error', 'Camp Not Found!');
                res.redirect("back");
            }
            else {
                if (found_camp.author.id.equals(req.user._id)) {
                    next();
                    console.log(found_camp.comments.length);
                }
                else {
                    req.flash("error", "You don't have required permission!");
                    res.redirect("back");
                }
            }
        })

    }
    else {
        req.flash('error', 'You need to login first!');
        res.redirect("back");
    }

}

function checkrepeatcomment(req, res, next) {
    if (req.isAuthenticated()) {
        Camp.findById(req.params.id, function(err, found_camp) {

            if (err || !found_camp) {
                req.flash('error', 'Camp Not Found!');
                res.redirect("back");
            }
            else {
                Comment.find({ _id: { $in: found_camp.comments } }, function(err, found_comment) {
                    console.log(found_comment);
                    var autharray = new Array();
                    for (var i = 0; i < found_comment.length; i++) {
                        autharray.push(String(found_comment[i].author.id));
                    }
                    console.log(autharray);
                    if (autharray.includes(req.user.id)) {
                        console.log("User already Exists");
                        res.redirect("/campgrounds/" + found_camp._id + "/comments/" + found_comment[autharray.indexOf(req.user.id)]._id + "/edit");

                    }
                    else {
                        return next();
                    }
                })
            }
        })
    }
    else {
        req.flash('error', 'You need to login first!');
        res.redirect("/login");
    }
}

function checkCommentOwnership(req, res, next) {
    if (req.isAuthenticated()) {

        Comment.findById(req.params.comment_id, function(err, found_comment) {

            if (err || !found_comment) {
                req.flash("error", "Comment not found");
                console.log(err);
                res.redirect("back");
            }
            else {
                if (found_comment.author.id.equals(req.user._id)) {
                    next();
                }
                else {
                    res.redirect("back");
                }
            }
        })

    }
    else {
        req.flash('error', 'You need to login first!');
        res.redirect("back");
    }

}

var timeDifference = function timeDifference(current, previous) {

    var msPerMinute = 60 * 1000;
    var msPerHour = msPerMinute * 60;
    var msPerDay = msPerHour * 24;
    var msPerMonth = msPerDay * 30;
    var msPerYear = msPerDay * 365;

    var elapsed = current - previous;

    if (elapsed < msPerMinute) {
        return Math.round(elapsed / 1000) + ' seconds ago';
    }

    else if (elapsed < msPerHour) {
        return Math.round(elapsed / msPerMinute) + ' minutes ago';
    }

    else if (elapsed < msPerDay) {
        return Math.round(elapsed / msPerHour) + ' hours ago';
    }

    else if (elapsed < msPerMonth) {
        return Math.round(elapsed / msPerDay) + ' days ago';
    }

    else if (elapsed < msPerYear) {
        return Math.round(elapsed / msPerMonth) + ' months ago';
    }

    else {
        return Math.round(elapsed / msPerYear) + ' years ago';
    }
}

app.listen(process.env.PORT, process.env.IP, function() {
    console.log("Yelpcamp Server Started!!");
})
