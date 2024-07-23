require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const Sequelize = require('sequelize');
const SequelizeStore = require('connect-session-sequelize')(session.Store);

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({
    extended: true
}));

// Initialize Sequelize with your database credentials
const sequelize = new Sequelize('userDB', 'root', 'password', {
    host: 'localhost',
    dialect: 'mysql',
    logging: false
});

// Define User model
const User = sequelize.define('user', {
    email: {
        type: Sequelize.STRING,
        unique: true,
        allowNull: false
    },
    password: {
        type: Sequelize.STRING,
        allowNull: false
    },
    secret: {
        type: Sequelize.TEXT,
        allowNull: true
    }
});

// Sync model with database
sequelize.sync();

// Set up session store
const sessionStore = new SequelizeStore({
    db: sequelize,
});

app.use(session({
    secret: "our little secret",
    store: sessionStore,
    resave: false,
    saveUninitialized: false
}));

sessionStore.sync();

app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy({
    usernameField: 'email'
}, (username, password, done) => {
    User.findOne({ where: { email: username } }).then(user => {
        if (!user) {
            return done(null, false, { message: 'Incorrect email.' });
        }
        if (user.password !== password) { // In production, use hashed passwords
            return done(null, false, { message: 'Incorrect password.' });
        }
        return done(null, user);
    }).catch(err => done(err));
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    User.findByPk(id).then(user => {
        done(null, user);
    }).catch(err => done(err));
});

app.get("/", (req, res) => {
    res.render("home");
});

app.get("/login", (req, res) => {
    res.render("login");
});

app.get("/register", (req, res) => {
    res.render("register");
});

app.get("/secrets", (req, res) => {
    User.findAll({ where: { secret: { [Sequelize.Op.ne]: null } } }).then(foundUsers => {
        if (foundUsers) {
            res.render("secrets", { userwithsecrets: foundUsers });
        }
    }).catch(err => console.log(err));
});

app.get("/logout", (req, res) => {
    req.logout((err) => {
        if (err) {
            console.log(err);
        }
        res.redirect("/");
    });
});

app.get("/submit", (req, res) => {
    if (req.isAuthenticated()) {
        res.render("submit");
    } else {
        res.redirect("/login");
    }
});

app.post("/submit", (req, res) => {
    const submittedSecret = req.body.secret;

    User.findByPk(req.user.id).then(foundUser => {
        if (foundUser) {
            foundUser.secret = submittedSecret;
            foundUser.save().then(() => {
                res.redirect("/secrets");
            });
        }
    }).catch(err => console.log(err));
});

app.post("/register", (req, res) => {
    User.create({
        email: req.body.username,
        password: req.body.password
    }).then(user => {
        req.login(user, (err) => {
            if (err) {
                console.log(err);
            } else {
                res.redirect("/secrets");
            }
        });
    }).catch(err => {
        console.log(err);
        res.redirect("/register");
    });
});

app.post("/login", (req, res) => {
    const user = new User({
        email: req.body.username,
        password: req.body.password
    });

    req.login(user, (err) => {
        if (err) {
            console.log(err);
        } else {
            passport.authenticate("local")(req, res, () => {
                res.redirect("/secrets");
            });
        }
    });
});

app.listen(3000, () => {
    console.log("server started at port 3000");
});
