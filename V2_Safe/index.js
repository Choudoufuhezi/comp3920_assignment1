require("dotenv").config();

const express = require("express");
const mysql = require("mysql2/promise");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcrypt");
const escape = require("escape-html");

const app = express();

function h(value) {
    return escape(String(value));
}


const mysql_db = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: process.env.MYSQL_PORT,
    namedPlaceholders: true,
});


app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
    }),
    cookie: {
        maxAge: 1000 * 60 * 60,     //one hour
    },
}));

app.use(express.urlencoded({ extended: false }));
app.use(express.static("public"));


app.get("/", (req, res) => {
    if (!req.session.username) {
        return res.send(`
            <a href="/signup">Sign up</a><br>
            <a href="/login">Log in</a>
        `);
    }

    const safeUsername = h(req.session.username);

    res.send(`
        <p>Hello, ${safeUsername}</p>
        <a href="/members">Go to Member Area</a><br>
        <a href="/logout">Logout</a>
    `);
});


app.get("/signup", (req, res) => {
    let message = "";

    if (req.query.error === "missing_username") {
        message = "Please provide a username";
    } else if (req.query.error === "missing_password") {
        message = "Please provide a password";
    } else if (req.query.error === "exists") {
        message = "User already exists";
    }

    res.send(`
        <form method="POST" action="/signup">
            <p>Create User</p>
            <label>Username: <input name="username" /></label><br>
            <label>Password: <input type="password" name="password" /></label><br>
            ${message ? `<p>${h(message)}</p>` : ""}
            <button type="submit">Submit</button>
        </form>
    `);
});

app.post("/signup", async (req, res) => {
    const { username, password } = req.body;

    if (!username) return res.redirect("/signup?error=missing_username");
    if (!password) return res.redirect("/signup?error=missing_password");

    try {
        const hash = await bcrypt.hash(password, 10);

        const sql = `
            INSERT INTO users (username, password)
            VALUES (:username, :password)
        `;

        await mysql_db.execute(sql, {
            username,
            password: hash,
        });

        req.session.username = username;
        res.redirect("/members");
    } catch (err) {
        return res.redirect("/signup?error=exists");
    }
});

app.get("/login", (req, res) => {
    let message = "";

    if (req.query.error === "missing_username") {
        message = "Please provide a username";
    } else if (req.query.error === "missing_password") {
        message = "Please provide a password";
    } else if (req.query.error === "failed_check") {
        message = "Username or password not found";
    }

    res.send(`
        <form method="POST" action="/login">
            <p>Log in</p>
            <label>Username: <input name="username" /></label><br>
            <label>Password: <input type="password" name="password" /></label><br>
            ${message ? `<p>${h(message)}</p>` : ""}
            <button type="submit">Submit</button>
        </form>
    `);
});

app.post("/login", async (req, res) => {
    const { username, password } = req.body;

    if (!username) return res.redirect("/login?error=missing_username");
    if (!password) return res.redirect("/login?error=missing_password");

    const sql = `
        SELECT * FROM users
        WHERE username = :username
    `;

    const [rows] = await mysql_db.execute(sql, { username });

    if (rows.length === 0) {
        return res.redirect("/login?error=failed_check");
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
        return res.redirect("/login?error=failed_check");
    }

    req.session.username = user.username;
    res.redirect("/members");
});


app.get("/members", (req, res) => {
    if (!req.session.username) {
        return res.redirect("/");
    }

    const images = [
        "images/BCIT.png",
        "images/SFU.png",
        "images/ubc.jpg",
    ];

    const randomImage = images[Math.floor(Math.random() * images.length)];
    const safeUsername = h(req.session.username);

    res.send(`
        <P>Hello, ${safeUsername}</P>
        <img src="${randomImage}" width="300" />
        <br>
        <a href="/logout">Sign out</a>
    `);
});


app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/");
    });
});

app.use((req, res) => {
    res.status(404).send("404 error: Page Not Found");
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Listening on http://localhost:${PORT}`);
});
