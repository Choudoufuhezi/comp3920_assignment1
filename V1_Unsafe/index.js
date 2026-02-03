require("dotenv").config();

const express = require("express");
const mysql = require("mysql2");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcrypt");

const app = express();

const mysql_db = mysql.createConnection({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: process.env.MYSQL_PORT
});

mysql_db.connect(err => {
  if (err) {
    console.error("MySQL connection failed:", err.message);
    process.exit(1);
  }
  console.log("MySQL connected (V1_Unsafe)");
});

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 // 1 hour
  }
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

  res.send(`
    <p>Hello, ${req.session.username}</p>
    <a href="/members">Members Area</a><br>
    <a href="/logout">Logout</a>
  `);
});

app.get("/signup", (req, res) => {
  res.send(`
    <p>create user</p>
    <form method="POST" action="/signup">
      Username: <input name="username"><br>
      Password: <input type="password" name="password"><br>
      <button type="submit">Submit</button>
    </form>
  `);
});

app.post("/signup", async (req, res) => {
  const { username, password } = req.body;

  const hash = await bcrypt.hash(password, 10);

  const sql = `
    INSERT INTO users (username, password)
    VALUES ('${username}', '${hash}')
  `;

  mysql_db.query(sql, err => {
    if (err) {
      return res.send("Signup failed (UNSAFE)");
    }

    req.session.username = username;
    res.redirect("/members");
  });
});

app.get("/login", (req, res) => {
  res.send(`
    <p>Log in</p>
    <form method="POST" action="/login">
      Username: <input name="username"><br>
      Password: <input type="password" name="password"><br>
      <button type="submit">Submit</button>
    </form>
  `);
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  const sql = `
    SELECT * FROM users
    WHERE username = '${username}'
  `;

  mysql_db.query(sql, async (err, rows) => {
    if (err || rows.length === 0) {
      return res.send("Login failed (UNSAFE)");
    }

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password);

    if (rows.length > 0) {
       req.session.username = rows[0].username;
       res.redirect("/members");
    } else {
        res.send("Login failed (UNSAFE)");
    }
  });
});

app.get("/members", (req, res) => {
  if (!req.session.username) {
    return res.redirect("/");
  }

  const images = [
    "images/BCIT.png",
    "images/SFU.png",
    "images/ubc.jpg"
  ];
  const randomImage = images[Math.floor(Math.random() * images.length)];

  res.send(`
    <p>Hello, ${req.session.username}</p>
    <img src="${randomImage}" width="300"><br>
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
app.listen(PORT, () =>
  console.log(`V1_Unsafe running at http://localhost:${PORT}`)
);