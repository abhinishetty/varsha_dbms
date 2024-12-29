const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');

// Initialize the Express app
const app = express();

// Use body-parser middleware to parse incoming request bodies
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());  // For parsing JSON bodies
app.use(express.static('public')); // Serve static files like HTML, CSS, and JS

// MySQL connection configuration
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '', // Make sure your password is correct
  database: 'emp' // Replace 'emp' with your actual database name
});

// Connect to the database
db.connect(err => {
  if (err) {
    console.error('Error connecting to the database:', err);
    process.exit(1);
  }
  console.log('Connected to the database.');
});

// Serve the login page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/login.html');
});

// Handle login requests (for both managers and employees)
app.post('/login', (req, res) => {
  const { UserId, Password, Role } = req.body;

  let query;
  if (Role === 'Manager') {
    query = 'SELECT * FROM manager WHERE ManagerId = ?';
  } else if (Role === 'Employee') {
    query = 'SELECT * FROM employee WHERE EmpId = ?';
  } else {
    return res.status(400).send('<h1>Invalid Role Selected</h1>');
  }

  // Query the database
  db.query(query, [UserId], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).send('<h1>An error occurred. Please try again later.</h1>');
    }

    if (results.length > 0) {
      const user = results[0];

      // Compare password directly without hashing
      if (Password === user.Password) {
        if (Role === 'Manager') {
          res.sendFile(__dirname + '/manager-dashboard.html');
        } else {
          res.sendFile(__dirname + '/employee-dashboard.html');
        }
      } else {
        res.send('<h1>Login failed. Incorrect password.</h1>');
      }
    } else {
      res.send('<h1>Login failed. User ID not found.</h1>');
    }
  });
});

// Route to fetch all employees (accessible by managers)
app.get('/employees', (req, res) => {
  const query = 'SELECT * FROM employee';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    res.json(results); // Return employee data as JSON
  });
});

// Route to add a new employee (accessible by managers)
app.post('/add-employee', (req, res) => {
  const { EmpId, Name, JobRole, Salary, ContactInfo, HireDate, ManagerId, Password } = req.body;

  // Check if all required fields are provided
  if (!EmpId || !Name || !JobRole || !Salary || !ContactInfo || !HireDate || !ManagerId || !Password) {
    return res.status(400).send('<h1>Missing required fields</h1>');
  }

  // Check if EmpId already exists
  const empQuery = 'SELECT * FROM employee WHERE EmpId = ?';
  db.query(empQuery, [EmpId], (err, empResults) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).send('<h1>An error occurred. Please try again later.</h1>');
    }

    if (empResults.length > 0) {
      return res.status(400).send('<h1>Employee ID already exists.</h1>');
    }

    // Check if ManagerId exists in the manager table
    const managerQuery = 'SELECT * FROM manager WHERE ManagerId = ?';
    db.query(managerQuery, [ManagerId], (err, managerResults) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).send('<h1>An error occurred. Please try again later.</h1>');
      }

      if (managerResults.length === 0) {
        return res.status(400).send('<h1>Manager ID does not exist.</h1>');
      }

      // SQL query to insert a new employee
      const query = `
        INSERT INTO employee (EmpId, Name, JobRole, Salary, ContactInfo, HireDate, ManagerId, Password)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      // Values to be inserted into the database
      const values = [EmpId, Name, JobRole, Salary, ContactInfo, HireDate, ManagerId, Password];

      db.query(query, values, (err, result) => {
        if (err) {
          console.error('Error adding employee:', err);
          return res.status(500).send('<h1>Failed to add employee. Please try again later.</h1>');
        }
        res.send('<h1>Employee added successfully!</h1>');
      });
    });
  });
});

// Route to fetch employee's payscale (accessible by employees)
app.get('/get-salary-slip', (req, res) => {
  const { EmpId } = req.query;

  if (!EmpId) {
    return res.status(400).json({ message: 'EmpId is required' });
  }

  const query = 'SELECT * FROM payscale WHERE EmpId = ?';
  db.query(query, [EmpId], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (results.length > 0) {
      res.json(results[0]);
    } else {
      res.status(404).json({ message: 'Salary slip not found' });
    }
  });
});

// Route to delete an employee (accessible by managers)
app.delete('/delete-employee', (req, res) => {
  const { EmpId, ManagerId } = req.body;

  // Check if EmpId and ManagerId are provided
  if (!EmpId || !ManagerId) {
    return res.status(400).send('<h1>Missing EmpId or ManagerId</h1>');
  }

  // Check if the ManagerId exists in the manager table
  const managerQuery = 'SELECT * FROM manager WHERE ManagerId = ?';
  db.query(managerQuery, [ManagerId], (err, managerResults) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).send('<h1>An error occurred. Please try again later.</h1>');
    }

    if (managerResults.length === 0) {
      return res.status(400).send('<h1>Manager ID does not exist.</h1>');
    }

    // Check if the employee exists before trying to delete
    const empQuery = 'SELECT * FROM employee WHERE EmpId = ?';
    db.query(empQuery, [EmpId], (err, empResults) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).send('<h1>An error occurred. Please try again later.</h1>');
      }

      if (empResults.length === 0) {
        return res.status(404).send('<h1>Employee not found.</h1>');
      }

      // Proceed with the deletion of the employee
      const deleteQuery = 'DELETE FROM employee WHERE EmpId = ?';
      db.query(deleteQuery, [EmpId], (err, result) => {
        if (err) {
          console.error('Error deleting employee:', err);
          return res.status(500).send('<h1>Failed to delete employee. Please try again later.</h1>');
        }

        // Successfully deleted
        res.send('<h1>Employee deleted successfully!</h1>');
      });
    });
  });
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
