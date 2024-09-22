const express = require('express');
const mysql = require('mysql');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
app.use(bodyParser.json());
app.use(cors());
app.use(morgan('dev'))
const SECRET_KEY = "your_secret_key";

// Setup MySQL connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'gowtham@MYSQL29',           // use the name we declare in the .env file 
  database: 'mappy_db'
});


db.connect(err => {
  if (err) throw err;
  console.log("Connected to MySQL");
});

// User registration
app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const query = `INSERT INTO users (name, email, password) VALUES (?, ?, ?)`;
  db.query(query, [name, email, hashedPassword], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: "Email already exists" });
      }
      throw err;
    }
    res.status(200).json({ message: "User registered successfully" });
  });
});

// User login
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  const query = `SELECT * FROM users WHERE email = ?`;
  db.query(query, [email], async (err, results) => {
    if (err) throw err;


    if (results.length === 0) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const user = results[0];

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: user.id }, SECRET_KEY, { expiresIn: '1h' });
    res.status(200).json({ token, userId: user.id });
  });
});


// Verify token and get user details
app.post('/user-details', (req, res) => {
  const { token } = req.body;

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) return res.status(401).json({ error: "Unauthorized" });

    const query = `SELECT name, email FROM users WHERE id = ?`;
    db.query(query, [decoded.userId], (err, results) => {
      if (err) throw err;
      res.status(200).json(results[0]);
    });
  });
});


//---------------------------------------------------------------------------------------------------------------------------------------------------------------



// Route to fetch activities for a specific user
app.get('/api/activities/:userId', (req, res) => {
  const userId = req.params.userId;


  // MySQL query to fetch money spending activities
  db.query(
    `SELECT 'money_spending' AS type, money_spending.id AS activity_id, money_spending.amount AS amount, money_spending.category AS investedFor, money_spending.latitude AS lat, money_spending.longitude AS lng, money_spending.spent_at AS activity_time 
       FROM money_spending 
       WHERE money_spending.user_id = ?`,
    [userId],
    (err, moneySpendingResults) => {
      if (err) {
        console.error('Error fetching money spending activities:', err);
        res.status(500).json({ error: 'Error fetching activities' });
        return;
      }

      // MySQL query to fetch workout activities
      db.query(
        `SELECT 'workout' AS type, workout.id AS activity_id, workout.workout_type AS workoutName, workout.duration AS workoutDuration, workout.calories_burned AS caloriesBurned, workout.latitude AS lat, workout.longitude AS lng, workout.created_at AS activity_time 
               FROM workout 
               WHERE workout.user_id = ?`,
        [userId],
        (err, workoutResults) => {
          if (err) {
            console.error('Error fetching workout activities:', err);
            res.status(500).json({ error: 'Error fetching activities' });
            return;
          }

          // MySQL query to fetch hangout activities
          db.query(
            `SELECT 'hangout' AS type, hangout.id AS activity_id, hangout.location AS place,hangout.hangout_Duration AS spendingDuration, hangout.description AS memorableMoments, hangout.latitude AS lat, hangout.longitude AS lng , hangout.created_at AS activity_time 
                       FROM hangout 
                       WHERE hangout.user_id = ?`,
            [userId],
            (err, hangoutResults) => {
              if (err) {
                console.error('Error fetching hangout activities:', err);
                res.status(500).json({ error: 'Error fetching activities' });
                return;
              }

              // MySQL query to fetch visiting activities
              db.query(
                `SELECT 'visiting' AS type, visiting.id AS activity_id, visiting.place AS placeName, visiting.duration AS spendingDuration, visiting.reason AS motive, visiting.latitude AS lat, visiting.longitude AS lng, visiting.created_at AS activity_time 
                               FROM visiting 
                               WHERE visiting.user_id = ?`,
                [userId],
                (err, visitingResults) => {
                  if (err) {
                    console.error('Error fetching visiting activities:', err);
                    res.status(500).json({ error: 'Error fetching activities' });
                    return;
                  }


                  // need to refer
                  const activities = [
                    ...moneySpendingResults, ...workoutResults, ...hangoutResults, ...visitingResults
                  ]

                  // Print the activities JSON response to the console
                  // console.log('Activities JSON Response:', JSON.stringify(activities, null, 2));

                  // Send activities as JSON response
                  res.json(activities);
                }
              );
            }
          );
        }
      );
    }
  );
});




// Route to insert activities for a specific user
app.post('/api/activities', (req, res) => {
  const { type, userId, ...activityData } = req.body;

  let query = '';
  let queryParams = [];

  switch (type) {
    case 'Money spending':
      query = `
        INSERT INTO money_spending (user_id, amount, category, latitude, longitude, spent_at)
        VALUES (?, ?, ?, ?, ?, NOW())
      `;
      queryParams = [userId, activityData.amount, activityData.investedFor, activityData.lat, activityData.lng];
      break;

    case 'Workout':
      query = `
        INSERT INTO workout (user_id, workout_type, duration, calories_burned, latitude, longitude, created_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
      `;
      queryParams = [userId, activityData.workoutName, activityData.workoutDuration, activityData.caloriesBurned, activityData.lat, activityData.lng];
      break;

    case 'Hangout':
      query = `
        INSERT INTO hangout (user_id, location, hangout_Duration, description, latitude, longitude, created_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
      `;
      queryParams = [userId, activityData.place, activityData.spendingDuration, activityData.memorableMoments, activityData.lat, activityData.lng];
      break;

    case 'Visiting':
      query = `
        INSERT INTO visiting (user_id, place, duration, reason, latitude, longitude, created_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
      `;
      queryParams = [userId, activityData.placeName, activityData.spendingDuration, activityData.motive, activityData.lat, activityData.lng];
      break;

    default:
      res.status(400).json({ error: 'Invalid activity type' });
      return;
  }

  db.query(query, queryParams, (err, result) => {
    if (err) {
      console.error('Error inserting activity:', err);
      res.status(500).json({ error: 'Error inserting activity' });
      return;
    }
    res.json({ message: 'Activity inserted successfully', activityId: result.insertId });
  });
});



app.delete('/api/activities/:type/:activityId/:userId', (req, res) => {
  const { type, activityId, userId } = req.params;

  let query = '';

  // Check the type of the activity and delete from the corresponding table
  switch (type) {
    case 'money_spending':
      query = `DELETE FROM money_spending WHERE id = ? AND user_id = ?`;
      break;

    case 'workout':
      query = `DELETE FROM workout WHERE id = ? AND user_id = ?`;
      break;

    case 'hangout':
      query = `DELETE FROM hangout WHERE id = ? AND user_id = ?`;
      break;

    case 'visiting':
      query = `DELETE FROM visiting WHERE id = ? AND user_id = ?`;
      break;

    default:
      res.status(400).json({ error: 'Invalid activity type' });
      return;
  }

  // Execute the delete query with the activityId and userId
  db.query(query, [activityId, userId], (err, result) => {
    if (err) {
      console.error('Error deleting activity:', err);
      res.status(500).json({ error: 'Error deleting activity' });
      return;
    }

    // Check if a row was deleted
    if (result.affectedRows === 0) {
      res.status(404).json({ message: 'Activity not found or does not belong to this user' });
      return;
    }

    res.json({ message: 'Activity deleted successfully' });
  });
});







app.listen(5000, () => {
  console.log("Server running on port 5000");
});
