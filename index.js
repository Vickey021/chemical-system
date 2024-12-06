const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const bodyParser = require('body-parser');
const app = express();

// Middleware to parse form data
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));


const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});


// Connect to the database
db.connect(err => {
    if (err) {
        console.error('Database connection failed:', err.message);
        process.exit(1);
    }
    console.log('Connected to the database.');
});

// Redirect root to login page
app.get('/', (req, res) => {
    res.redirect('/login');
});

// Serve the Login Page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Handle Login Form Submission
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    db.query(
        'SELECT * FROM Users WHERE Username = ? AND Password = ?',
        [username, password],
        (err, results) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error validating credentials');
            } else if (results.length > 0) {
                // Redirect to the dashboard if login is successful
                res.redirect('/dashboard');
            } else {
                // Invalid credentials
                res.send(`
                    <script>
                        alert('Invalid username or password');
                        window.location.href = '/login';
                    </script>
                `);
            }
        }
    );
});

// Serve the Dashboard
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// API Endpoints (Data fetching)
app.get('/api/stocks', (req, res) => {
    db.query('SELECT * FROM Stock', (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error fetching stocks');
        } else {
            res.json(results);
        }
    });
});

// Fetch Supplier Transactions
app.get('/api/supplier-transactions', (req, res) => {
    db.query('SELECT * FROM SupplierTransactions', (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error fetching supplier transactions');
        } else {
            res.json(results); // Send the results as JSON
        }
    });
});

// Fetch Customer Transactions
app.get('/api/customer-transactions', (req, res) => {
    db.query('SELECT * FROM CustomerTransactions', (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error fetching customer transactions');
        } else {
            res.json(results); // Send the results as JSON
        }
    });
});



// Fetch Reports (Purchase and Sales Summary)
app.get('/api/reports', (req, res) => {
    // Example: Get total purchase and sales amounts
    const query = `
        SELECT 
            (SELECT SUM(Amount) FROM SupplierTransactions) AS totalPurchases,
            (SELECT SUM(Amount) FROM CustomerTransactions) AS totalSales;
    `;
    db.query(query, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error generating reports');
        } else {
            res.json(results);
        }
    });
});


// Fetch Alerts (Low Stock and Pending Payments)
app.get('/api/alerts', (req, res) => {
    const alerts = {};

    // Check for low stock (Threshold of 10 units)
    db.query('SELECT * FROM Stock WHERE Quantity < 10', (err, stockResults) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error fetching low stock alerts');
            return;
        }
        alerts.lowStock = stockResults;

        // Check for pending supplier transactions (Paid = "Pending" and date > 30 days ago)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Query pending supplier transactions that are older than 30 days
        db.query(
            'SELECT * FROM SupplierTransactions WHERE PaymentStatus = "Pending" AND Date < ?',
            [thirtyDaysAgo],
            (err, supplierTransactionResults) => {
                if (err) {
                    console.error(err);
                    res.status(500).send('Error fetching pending supplier transactions');
                    return;
                }

                // Query pending customer transactions that are older than 30 days
                db.query(
                    'SELECT * FROM CustomerTransactions WHERE PaymentStatus = "Pending" AND Date < ?',
                    [thirtyDaysAgo],
                    (err, customerTransactionResults) => {
                        if (err) {
                            console.error(err);
                            res.status(500).send('Error fetching pending customer transactions');
                            return;
                        }

                        alerts.pendingPayments = [
                            ...supplierTransactionResults,
                            ...customerTransactionResults
                        ];

                        // Send combined alerts (low stock and pending payments)
                        res.json(alerts);
                    }
                );
            }
        );
    });
});



// Start the server
// Export the app to make it work in Vercel's serverless environment
module.exports = app;